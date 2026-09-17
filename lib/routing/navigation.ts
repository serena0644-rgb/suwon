import { cumulativeDistances, haversine, pathLength, projectOnPath } from "./geo";
import type { LatLng, RouteStep, WalkRoute } from "./types";

/** 이 거리(m) 이상 경로에서 벗어나면 이탈로 봅니다. 도심 보행 GPS 오차를 감안한 값입니다. */
export const OFF_ROUTE_THRESHOLD = 45;
/** 목적지에 이만큼 가까워지면 도착으로 처리합니다. */
export const ARRIVAL_THRESHOLD = 25;
/** 안내 지점을 지났다고 볼 여유 거리. */
const STEP_PASSED_TOLERANCE = 8;

export type NavigationIndex = {
  cumulative: number[];
  /** legBounds[i] = i번째 구간이 끝나는 누적 거리(m). */
  legBounds: number[];
  total: number;
};

export type NavigationProgress = {
  arrived: boolean;
  distanceFromPath: number;
  distanceToNextStep: number;
  legIndex: number;
  nextStep: RouteStep | null;
  offRoute: boolean;
  remainingDistance: number;
  remainingDuration: number;
  traveled: number;
  /** 다음 안내 지점 이후에 올 안내. 미리보기용. */
  upcomingStep: RouteStep | null;
};

export function buildNavigationIndex(route: WalkRoute): NavigationIndex {
  const cumulative = cumulativeDistances(route.path);
  const legBounds: number[] = [];
  let running = 0;

  for (const leg of route.legs) {
    running += pathLength(leg.path);
    legBounds.push(running);
  }

  return { cumulative, legBounds, total: cumulative[cumulative.length - 1] ?? 0 };
}

export function computeProgress(
  route: WalkRoute,
  index: NavigationIndex,
  position: LatLng,
): NavigationProgress | null {
  const projection = projectOnPath(route.path, position, index.cumulative);
  if (!projection) return null;

  const total = index.total || route.distance;
  const traveled = Math.min(projection.traveled, total);
  const remainingDistance = Math.max(0, total - traveled);
  const ratio = total > 0 ? remainingDistance / total : 0;

  const destination = route.path[route.path.length - 1];
  const arrived =
    remainingDistance <= ARRIVAL_THRESHOLD ||
    (destination ? haversine(position, destination) <= ARRIVAL_THRESHOLD : false);

  let legIndex = index.legBounds.findIndex((bound) => traveled < bound - 1e-6);
  if (legIndex < 0) legIndex = Math.max(0, route.legs.length - 1);

  // 진행 거리는 실제 경로 위 누적 거리 기준이므로, 안내 지점 거리와 그대로 비교할 수 있습니다.
  const upcoming = route.steps.filter(
    (step) => step.distance > traveled + STEP_PASSED_TOLERANCE && step.kind !== "start",
  );
  const nextStep = upcoming[0] ?? null;

  return {
    arrived,
    distanceFromPath: projection.distanceFromPath,
    distanceToNextStep: nextStep ? Math.max(0, nextStep.distance - traveled) : remainingDistance,
    legIndex,
    nextStep,
    offRoute: projection.distanceFromPath > OFF_ROUTE_THRESHOLD,
    remainingDistance,
    remainingDuration: Math.round(route.duration * ratio),
    traveled,
    upcomingStep: upcoming[1] ?? null,
  };
}
