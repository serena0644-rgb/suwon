export type LatLng = {
  lat: number;
  lng: number;
};

export type RoutePoint = LatLng & {
  /** 사용자에게 보여줄 이름. 지도 클릭 지점이면 "지도에서 선택한 지점" 같은 기본값이 들어갑니다. */
  name: string;
};

/**
 * TMAP 보행자 경로안내의 searchOption 에 대응하는 탐색 옵션입니다.
 * 무장애 서비스이므로 기본값은 계단을 제외하는 `no-stairs` 입니다.
 */
export type WalkOption = "no-stairs" | "recommend" | "main-road" | "shortest";

export type StepKind =
  | "crosswalk"
  | "goal"
  | "overpass"
  | "ramp"
  | "stairs"
  | "start"
  | "straight"
  | "turn"
  | "underpass"
  | "waypoint";

export type RouteStep = {
  /** 안내 문구. 예: "직진 후 횡단보도 건너기" */
  description: string;
  /** 경로 시작점부터 이 안내 지점까지의 누적 거리(m). */
  distance: number;
  kind: StepKind;
  /** 이 안내 지점이 속한 구간(leg) 번호. 병합 후에 채워집니다. */
  legIndex: number;
  position: LatLng;
  /** 교통약자에게 알려야 하는 주의 문구. 없으면 null. */
  warning: string | null;
};

export type RouteLeg = {
  distance: number;
  duration: number;
  /** 실제 보행로를 못 받아와 직선으로 대체한 구간인지 여부. */
  fallback: boolean;
  from: RoutePoint;
  path: LatLng[];
  steps: RouteStep[];
  to: RoutePoint;
};

export type WalkRoute = {
  distance: number;
  duration: number;
  legs: RouteLeg[];
  option: WalkOption;
  path: LatLng[];
  steps: RouteStep[];
  /** 계단·육교 등 무장애 관점의 주의 구간 요약. */
  warnings: string[];
};

export type WalkRouteSource = "fallback" | "partial" | "tmap";

export type WalkRouteResponse = {
  message: string | null;
  ok: boolean;
  route: WalkRoute;
  source: WalkRouteSource;
};

export const WALK_OPTION_LABELS: Record<WalkOption, string> = {
  "main-road": "대로 우선",
  "no-stairs": "계단 제외 (무장애 권장)",
  recommend: "추천 경로",
  shortest: "최단 거리",
};

export function isWalkOption(value: unknown): value is WalkOption {
  return value === "no-stairs" || value === "recommend" || value === "main-road" || value === "shortest";
}
