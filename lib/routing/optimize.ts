import { haversine } from "./geo";
import type { LatLng } from "./types";

/**
 * 방문 순서 최적화.
 *
 * 비용 행렬은 실제 보행 거리가 아니라 직선(하버사인) 거리로 만듭니다.
 * 실제 보행 거리를 쓰려면 N^2 번의 경로탐색 API 호출이 필요한데,
 * 도심 보행 스케일(수백 m ~ 수 km)에서는 직선 거리 순위와 보행 거리 순위가 거의 일치하므로
 * 호출 비용 대비 이득이 없다고 판단했습니다.
 * 최적화로 확정된 순서에 대해서만 실제 보행 경로를 1회 조회합니다.
 */

/** 이 개수 이하의 중간 경유지는 Held-Karp 로 정확해를 구합니다. */
const EXACT_INTERIOR_LIMIT = 10;
/** 출발지를 고정하지 않을 때 정확해를 시도할 최대 전체 지점 수. */
const EXACT_FREE_START_LIMIT = 8;

export type OptimizeOptions = {
  /** 마지막 지점을 도착지로 고정합니다. */
  fixEnd?: boolean;
  /** 첫 지점을 출발지로 고정합니다. 기본 true. */
  fixStart?: boolean;
};

export type OptimizeResult = {
  /** 기존 순서보다 총 이동거리가 줄었는지 여부. */
  improved: boolean;
  /** 원본 배열 기준 인덱스 방문 순서. */
  order: number[];
  /** 최적화 전 총 직선 거리(m). */
  originalTotal: number;
  /** 최적화 후 총 직선 거리(m). */
  total: number;
};

export function buildMatrix(points: LatLng[]): number[][] {
  return points.map((from) => points.map((to) => haversine(from, to)));
}

export function pathCost(order: number[], matrix: number[][]): number {
  let total = 0;
  for (let index = 1; index < order.length; index += 1) {
    total += matrix[order[index - 1]][order[index]];
  }
  return total;
}

export function optimizeOrder(points: LatLng[], options: OptimizeOptions = {}): OptimizeResult {
  const { fixEnd = false, fixStart = true } = options;
  const identity = points.map((_, index) => index);
  const matrix = buildMatrix(points);
  const originalTotal = pathCost(identity, matrix);

  if (points.length <= 3) {
    return { improved: false, order: identity, originalTotal, total: originalTotal };
  }

  const endIndex = fixEnd ? points.length - 1 : -1;
  let best: number[];

  if (fixStart) {
    const interior = identity.filter((index) => index !== 0 && index !== endIndex);
    best = solve(matrix, 0, endIndex, interior, true);
  } else {
    const allowExact = points.length <= EXACT_FREE_START_LIMIT;
    let bestCost = Number.POSITIVE_INFINITY;
    best = identity;
    for (const start of identity) {
      if (start === endIndex) continue;
      const interior = identity.filter((index) => index !== start && index !== endIndex);
      const candidate = solve(matrix, start, endIndex, interior, allowExact);
      const cost = pathCost(candidate, matrix);
      if (cost < bestCost) {
        bestCost = cost;
        best = candidate;
      }
    }
  }

  const total = pathCost(best, matrix);
  return { improved: total < originalTotal - 0.5, order: best, originalTotal, total };
}

function solve(
  matrix: number[][],
  start: number,
  end: number,
  interior: number[],
  allowExact: boolean,
): number[] {
  const tail = end >= 0 ? [end] : [];
  if (interior.length === 0) return [start, ...tail];
  if (interior.length === 1) return [start, interior[0], ...tail];

  if (allowExact && interior.length <= EXACT_INTERIOR_LIMIT) {
    return heldKarp(matrix, start, end, interior);
  }
  return twoOpt(nearestNeighbor(matrix, start, end, interior), matrix, end >= 0);
}

/** 중간 경유지에 대한 정확한 최소비용 해밀턴 경로 (비트마스크 DP). */
function heldKarp(matrix: number[][], start: number, end: number, nodes: number[]): number[] {
  const count = nodes.length;
  const size = 1 << count;
  const cost = new Float64Array(size * count).fill(Number.POSITIVE_INFINITY);
  const parent = new Int16Array(size * count).fill(-1);

  for (let node = 0; node < count; node += 1) {
    cost[(1 << node) * count + node] = matrix[start][nodes[node]];
  }

  for (let mask = 1; mask < size; mask += 1) {
    for (let last = 0; last < count; last += 1) {
      if ((mask & (1 << last)) === 0) continue;
      const current = cost[mask * count + last];
      if (!Number.isFinite(current)) continue;
      for (let next = 0; next < count; next += 1) {
        if ((mask & (1 << next)) !== 0) continue;
        const nextMask = mask | (1 << next);
        const candidate = current + matrix[nodes[last]][nodes[next]];
        if (candidate < cost[nextMask * count + next]) {
          cost[nextMask * count + next] = candidate;
          parent[nextMask * count + next] = last;
        }
      }
    }
  }

  const full = size - 1;
  let bestLast = 0;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let last = 0; last < count; last += 1) {
    const candidate = cost[full * count + last] + (end >= 0 ? matrix[nodes[last]][end] : 0);
    if (candidate < bestCost) {
      bestCost = candidate;
      bestLast = last;
    }
  }

  const sequence: number[] = [];
  let mask = full;
  let last = bestLast;
  while (last >= 0) {
    sequence.push(nodes[last]);
    const previous = parent[mask * count + last];
    mask ^= 1 << last;
    last = previous;
  }
  sequence.reverse();

  return [start, ...sequence, ...(end >= 0 ? [end] : [])];
}

function nearestNeighbor(matrix: number[][], start: number, end: number, nodes: number[]): number[] {
  const remaining = new Set(nodes);
  const sequence: number[] = [];
  let current = start;

  while (remaining.size > 0) {
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of remaining) {
      const distance = matrix[current][candidate];
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    sequence.push(best);
    remaining.delete(best);
    current = best;
  }

  return [start, ...sequence, ...(end >= 0 ? [end] : [])];
}

function twoOpt(order: number[], matrix: number[][], fixEnd: boolean): number[] {
  const low = 1;
  const high = fixEnd ? order.length - 2 : order.length - 1;
  let best = order.slice();
  let bestCost = pathCost(best, matrix);
  let improved = true;
  let guard = 0;

  while (improved && guard < 100) {
    improved = false;
    guard += 1;
    for (let i = low; i < high; i += 1) {
      for (let j = i + 1; j <= high; j += 1) {
        const candidate = best
          .slice(0, i)
          .concat(best.slice(i, j + 1).reverse(), best.slice(j + 1));
        const candidateCost = pathCost(candidate, matrix);
        if (candidateCost < bestCost - 1e-6) {
          best = candidate;
          bestCost = candidateCost;
          improved = true;
        }
      }
    }
  }

  return best;
}
