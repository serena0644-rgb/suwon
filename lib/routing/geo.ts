import type { LatLng } from "./types";

const EARTH_RADIUS = 6_371_000;
const METERS_PER_DEGREE_LAT = 110_540;
const METERS_PER_DEGREE_LNG = 111_320;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

/** 두 좌표 사이의 대권 거리(m). */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 폴리라인 전체 길이(m). */
export function pathLength(path: LatLng[]): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += haversine(path[index - 1], path[index]);
  }
  return total;
}

/** path[i] 까지의 누적 거리 배열. */
export function cumulativeDistances(path: LatLng[]): number[] {
  const out: number[] = new Array(path.length);
  out[0] = 0;
  for (let index = 1; index < path.length; index += 1) {
    out[index] = out[index - 1] + haversine(path[index - 1], path[index]);
  }
  return out;
}

export type PathProjection = {
  /** 경로에서 벗어난 거리(m). 경로 이탈 판정에 사용합니다. */
  distanceFromPath: number;
  /** 투영된 지점이 속한 구간(segment) 시작 인덱스. */
  segmentIndex: number;
  point: LatLng;
  /** 경로 시작점부터 투영 지점까지 진행한 거리(m). */
  traveled: number;
};

/**
 * 현재 위치를 경로 위로 투영합니다.
 * 짧은 거리에서만 쓰이므로 등장방형(equirectangular) 근사로 평면 변환 후 계산합니다.
 */
export function projectOnPath(
  path: LatLng[],
  target: LatLng,
  cumulative?: number[],
): PathProjection | null {
  if (path.length === 0) return null;
  if (path.length === 1) {
    return { distanceFromPath: haversine(path[0], target), point: path[0], segmentIndex: 0, traveled: 0 };
  }

  const totals = cumulative ?? cumulativeDistances(path);
  const scaleX = Math.cos(toRadians(target.lat)) * METERS_PER_DEGREE_LNG;
  const scaleY = METERS_PER_DEGREE_LAT;
  const targetX = target.lng * scaleX;
  const targetY = target.lat * scaleY;

  let best: PathProjection | null = null;

  for (let index = 0; index < path.length - 1; index += 1) {
    const ax = path[index].lng * scaleX;
    const ay = path[index].lat * scaleY;
    const bx = path[index + 1].lng * scaleX;
    const by = path[index + 1].lat * scaleY;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const ratio =
      lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((targetX - ax) * dx + (targetY - ay) * dy) / lengthSquared));
    const px = ax + ratio * dx;
    const py = ay + ratio * dy;
    const distanceFromPath = Math.hypot(targetX - px, targetY - py);

    if (!best || distanceFromPath < best.distanceFromPath) {
      best = {
        distanceFromPath,
        point: { lat: py / scaleY, lng: px / scaleX },
        segmentIndex: index,
        traveled: totals[index] + (totals[index + 1] - totals[index]) * ratio,
      };
    }
  }

  return best;
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "-";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "-";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "1분 미만";
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}
