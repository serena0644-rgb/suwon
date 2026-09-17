import { haversine, pathLength } from "./geo";
import type {
  LatLng,
  RouteLeg,
  RoutePoint,
  RouteStep,
  StepKind,
  WalkOption,
} from "./types";

/**
 * TMAP 보행자 경로안내 API 클라이언트 (서버 전용).
 *
 * 카카오 지도 JS SDK 에는 보행자 길찾기가 없고, 카카오모빌리티 길찾기 API 는 자동차 전용이라
 * 실제 보도를 따라가는 경로를 만들려면 별도 API 가 필요합니다. TMAP 보행자 경로안내는
 * 국내 보도/횡단보도/지하보도 데이터를 갖고 있고 searchOption 으로 계단 회피를 지정할 수 있어
 * 무장애 서비스에 가장 적합합니다.
 */

const PEDESTRIAN_URL =
  "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1";
const REQUEST_TIMEOUT_MS = 8_000;

/** WalkOption -> TMAP searchOption */
const SEARCH_OPTIONS: Record<WalkOption, string> = {
  "main-road": "4",
  "no-stairs": "30",
  recommend: "0",
  shortest: "10",
};

const STEP_WARNINGS: Partial<Record<StepKind, string>> = {
  overpass: "육교 구간입니다. 엘리베이터가 없으면 우회가 필요합니다.",
  stairs: "계단 구간입니다. 휠체어·유모차는 우회로를 확인하세요.",
  underpass: "지하보도 구간입니다. 엘리베이터가 없으면 우회가 필요합니다.",
};

const DEFAULT_DESCRIPTIONS: Record<StepKind, string> = {
  crosswalk: "횡단보도를 건너세요",
  goal: "목적지에 도착합니다",
  overpass: "육교를 건너세요",
  ramp: "경사로를 따라 이동하세요",
  stairs: "계단 구간입니다",
  start: "출발합니다",
  straight: "직진하세요",
  turn: "방향을 바꾸세요",
  underpass: "지하보도를 따라 이동하세요",
  waypoint: "경유지에 도착합니다",
};

type TmapProperties = {
  description?: unknown;
  distance?: unknown;
  pointType?: unknown;
  time?: unknown;
  totalDistance?: unknown;
  totalTime?: unknown;
  turnType?: unknown;
};

type TmapFeature = {
  geometry?: { coordinates?: unknown; type?: unknown };
  properties?: TmapProperties;
};

export class TmapRouteError extends Error {}

export function hasTmapKey(): boolean {
  return Boolean(process.env.TMAP_APP_KEY);
}

/**
 * 한 구간(출발 → 도착)의 실제 보행 경로를 가져옵니다.
 * 선택한 옵션을 유지하며, API 실패를 상위 호출자에게 전달합니다.
 */
export async function fetchWalkLeg(
  from: RoutePoint,
  to: RoutePoint,
  option: WalkOption,
  speed: number,
): Promise<RouteLeg> {
  const appKey = process.env.TMAP_APP_KEY;
  if (!appKey) {
    throw new TmapRouteError("TMAP_APP_KEY 환경변수가 설정되지 않았습니다.");
  }

  return parseFeatureCollection(
    await request(appKey, from, to, option, speed),
    from,
    to,
  );
}

async function request(
  appKey: string,
  from: RoutePoint,
  to: RoutePoint,
  option: WalkOption,
  speed: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(PEDESTRIAN_URL, {
      body: JSON.stringify({
        endName: encodeURIComponent(to.name || "도착"),
        endX: String(to.lng),
        endY: String(to.lat),
        reqCoordType: "WGS84GEO",
        resCoordType: "WGS84GEO",
        searchOption: SEARCH_OPTIONS[option],
        sort: "index",
        speed: String(Math.max(1, Math.round(speed))),
        startName: encodeURIComponent(from.name || "출발"),
        startX: String(from.lng),
        startY: String(from.lat),
      }),
      cache: "no-store",
      headers: {
        accept: "application/json",
        appKey,
        "content-type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new TmapRouteError(
        readErrorMessage(payload) ||
          `TMAP 경로탐색 실패 (HTTP ${response.status})`,
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof TmapRouteError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TmapRouteError("TMAP 경로탐색 응답이 지연되어 중단했습니다.");
    }
    throw new TmapRouteError(
      error instanceof Error
        ? error.message
        : "TMAP 경로탐색 중 오류가 발생했습니다.",
    );
  } finally {
    clearTimeout(timer);
  }
}

function readErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const error = (payload as { error?: unknown }).error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

function parseFeatureCollection(
  payload: unknown,
  from: RoutePoint,
  to: RoutePoint,
): RouteLeg {
  const features = readFeatures(payload);
  if (features.length === 0) {
    throw new TmapRouteError("TMAP 응답에 경로 정보가 없습니다.");
  }

  const path: LatLng[] = [];
  const steps: RouteStep[] = [];
  let traveled = 0;
  let totalDistance = 0;
  let totalTime = 0;

  for (const feature of features) {
    const properties = feature.properties ?? {};
    const declaredDistance = toNumber(properties.totalDistance);
    const declaredTime = toNumber(properties.totalTime);
    if (declaredDistance !== null) totalDistance = declaredDistance;
    if (declaredTime !== null) totalTime = declaredTime;

    const geometryType =
      typeof feature.geometry?.type === "string" ? feature.geometry.type : "";
    const description =
      typeof properties.description === "string"
        ? properties.description.trim()
        : "";

    if (geometryType === "Point") {
      const position = toLatLng(feature.geometry?.coordinates);
      if (!position) continue;
      const turnType = toNumber(properties.turnType) ?? 0;
      const kind = classifyPoint(turnType, description);
      steps.push({
        description: description || DEFAULT_DESCRIPTIONS[kind],
        distance: traveled,
        kind,
        legIndex: 0,
        position,
        warning: STEP_WARNINGS[kind] ?? null,
      });
      continue;
    }

    if (geometryType !== "LineString") continue;

    // 선 구간의 안내 문구에 계단/육교/지하보도가 등장하면, 그 구간이 시작되는 직전 안내 지점에 경고를 올려 둡니다.
    const lineKind = classifyLine(description);
    if (lineKind && steps.length > 0) {
      const previous = steps[steps.length - 1];
      if (!previous.warning) {
        previous.kind = lineKind;
        previous.warning = STEP_WARNINGS[lineKind] ?? null;
      }
    }

    for (const point of toLatLngList(feature.geometry?.coordinates)) {
      const last = path[path.length - 1];
      if (last && last.lat === point.lat && last.lng === point.lng) continue;
      if (last) traveled += haversine(last, point);
      path.push(point);
    }
  }

  if (path.length < 2) {
    throw new TmapRouteError("TMAP 응답에서 보행 경로를 해석하지 못했습니다.");
  }

  const distance = totalDistance > 0 ? totalDistance : pathLength(path);

  return {
    distance,
    duration: totalTime > 0 ? totalTime : 0,
    fallback: false,
    from,
    path,
    steps,
    to,
  };
}

function readFeatures(payload: unknown): TmapFeature[] {
  if (!payload || typeof payload !== "object") return [];
  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  return features.filter(
    (feature): feature is TmapFeature =>
      Boolean(feature) && typeof feature === "object",
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toLatLng(value: unknown): LatLng | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lng = toNumber(value[0]);
  const lat = toNumber(value[1]);
  if (lng === null || lat === null) return null;
  return { lat, lng };
}

function toLatLngList(value: unknown): LatLng[] {
  if (!Array.isArray(value)) return [];
  const out: LatLng[] = [];
  for (const entry of value) {
    const point = toLatLng(entry);
    if (point) out.push(point);
  }
  return out;
}

/**
 * turnType 숫자표는 TMAP 문서 기준이지만 버전에 따라 값이 늘어날 수 있어,
 * 안내 문구(한국어) 를 먼저 보고 숫자는 보조로만 사용합니다.
 */
function classifyPoint(turnType: number, description: string): StepKind {
  const fromText = classifyLine(description);
  if (fromText) return fromText;
  if (description.includes("횡단보도")) return "crosswalk";

  if (turnType === 200) return "start";
  if (turnType === 201) return "goal";
  if (turnType >= 182 && turnType <= 190) return "waypoint";
  if (turnType >= 211 && turnType <= 218) return "crosswalk";
  if (
    turnType === 233 ||
    turnType === 235 ||
    turnType === 236 ||
    turnType === 238
  )
    return "stairs";
  if (turnType === 234 || turnType === 237) return "ramp";
  if (turnType >= 11 && turnType <= 19) return "turn";
  return "straight";
}

function classifyLine(description: string): StepKind | null {
  if (!description) return null;
  if (description.includes("계단")) return "stairs";
  if (description.includes("육교")) return "overpass";
  if (description.includes("지하보도")) return "underpass";
  if (description.includes("경사로")) return "ramp";
  return null;
}
