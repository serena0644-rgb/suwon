import { NextResponse } from "next/server";
import { pathLength } from "@/lib/routing/geo";
import { DEFAULT_WALK_SPEED_KMH } from "@/lib/routing/constants";
import { fetchWalkLeg, hasTmapKey, straightLeg } from "@/lib/routing/tmap";
import { isWalkOption } from "@/lib/routing/types";
import type {
  RouteLeg,
  RoutePoint,
  RouteStep,
  WalkOption,
  WalkRoute,
  WalkRouteResponse,
  WalkRouteSource,
} from "@/lib/routing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_POINTS = 12;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 300;

/**
 * 같은 구간을 반복 조회하는 것을 막는 단순 인메모리 캐시입니다.
 * 서버리스에서는 인스턴스 단위로만 유지되지만, 한 사용자가 지도를 조작하는 동안의
 * 중복 호출을 줄이는 것만으로도 충분합니다.
 */
const legCache = new Map<string, { leg: RouteLeg; expiresAt: number }>();

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 요청 형식입니다.", ok: false }, { status: 400 });
  }

  const points = parsePoints((body as { points?: unknown })?.points);

  if (points.length < 2) {
    return NextResponse.json(
      { message: "경로를 만들려면 두 곳 이상을 선택해 주세요.", ok: false },
      { status: 400 },
    );
  }

  if (points.length > MAX_POINTS) {
    return NextResponse.json(
      { message: `경유지는 최대 ${MAX_POINTS}곳까지 선택할 수 있습니다.`, ok: false },
      { status: 400 },
    );
  }

  const rawOption = (body as { option?: unknown })?.option;
  const option: WalkOption = isWalkOption(rawOption) ? rawOption : "no-stairs";
  const speed = parseSpeed((body as { speed?: unknown })?.speed);
  const keyed = hasTmapKey();

  const legs = await Promise.all(
    points.slice(0, -1).map((from, index) => resolveLeg(from, points[index + 1], option, speed, keyed)),
  );

  const failures = legs.filter((leg) => leg.fallback).length;
  const source: WalkRouteSource = failures === 0 ? "tmap" : failures === legs.length ? "fallback" : "partial";

  return NextResponse.json({
    message: buildMessage(source, keyed),
    ok: source !== "fallback",
    route: mergeLegs(legs, option, speed),
    source,
  } satisfies WalkRouteResponse);
}

async function resolveLeg(
  from: RoutePoint,
  to: RoutePoint,
  option: WalkOption,
  speed: number,
  keyed: boolean,
): Promise<RouteLeg> {
  if (!keyed) return straightLeg(from, to, speed);

  const cacheKey = buildCacheKey(from, to, option, speed);
  const cached = legCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.leg, from, to };
  }

  try {
    const leg = await fetchWalkLeg(from, to, option, speed);
    rememberLeg(cacheKey, leg);
    return leg;
  } catch (error) {
    console.error("[route/walk] TMAP 보행자 경로탐색 실패", error);
    return straightLeg(from, to, speed);
  }
}

function rememberLeg(cacheKey: string, leg: RouteLeg) {
  if (legCache.size >= CACHE_LIMIT) {
    const oldest = legCache.keys().next();
    if (!oldest.done) legCache.delete(oldest.value);
  }
  legCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, leg });
}

function buildCacheKey(from: RoutePoint, to: RoutePoint, option: WalkOption, speed: number) {
  const round = (value: number) => value.toFixed(6);
  return [round(from.lat), round(from.lng), round(to.lat), round(to.lng), option, speed].join("|");
}

/** 구간별 경로를 하나의 경로로 합치면서 안내 지점의 누적 거리를 다시 계산합니다. */
function mergeLegs(legs: RouteLeg[], option: WalkOption, speed: number): WalkRoute {
  const path: WalkRoute["path"] = [];
  const steps: RouteStep[] = [];
  const warnings = new Set<string>();
  let offset = 0;
  let distance = 0;
  let duration = 0;

  legs.forEach((leg, legIndex) => {
    const isLast = legIndex === legs.length - 1;

    for (const point of leg.path) {
      const last = path[path.length - 1];
      if (last && last.lat === point.lat && last.lng === point.lng) continue;
      path.push(point);
    }

    for (const step of leg.steps) {
      // 구간 경계에서 "도착" 과 다음 구간 "출발" 이 겹치므로 하나만 남깁니다.
      if (step.kind === "start" && legIndex > 0) continue;
      const kind = step.kind === "goal" && !isLast ? "waypoint" : step.kind;
      const merged: RouteStep = {
        ...step,
        description:
          kind === "waypoint" && step.kind === "goal" ? `${leg.to.name} 경유지 도착` : step.description,
        distance: offset + step.distance,
        kind,
        legIndex,
      };
      if (merged.warning) warnings.add(merged.warning);
      steps.push(merged);
    }

    offset += leg.distance;
    distance += leg.distance;
    duration += leg.duration > 0 ? leg.duration : estimateDuration(leg.distance, speed);
  });

  if (distance <= 0) distance = pathLength(path);

  return {
    distance,
    duration,
    legs,
    option,
    path,
    steps,
    warnings: [...warnings],
  };
}

function estimateDuration(distance: number, speed: number) {
  return Math.round(distance / ((speed * 1000) / 3600));
}

function buildMessage(source: WalkRouteSource, keyed: boolean): string | null {
  if (source === "tmap") return null;
  if (!keyed) {
    return "TMAP_APP_KEY 환경변수가 없어 실제 보행로 대신 직선 경로로 표시합니다. 거리와 시간은 근사치입니다.";
  }
  if (source === "fallback") {
    return "보행자 경로탐색에 실패해 직선 경로로 표시합니다. 잠시 후 다시 시도해 주세요.";
  }
  return "일부 구간의 보행자 경로를 받지 못해 해당 구간만 직선으로 표시합니다.";
}

function parsePoints(value: unknown): RoutePoint[] {
  if (!Array.isArray(value)) return [];
  const out: RoutePoint[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const lat = Number((entry as { lat?: unknown }).lat);
    const lng = Number((entry as { lng?: unknown }).lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    const rawName = (entry as { name?: unknown }).name;
    out.push({
      lat,
      lng,
      name: typeof rawName === "string" && rawName.trim() ? rawName.trim().slice(0, 60) : "선택한 지점",
    });
  }

  return out;
}

function parseSpeed(value: unknown): number {
  const speed = Number(value);
  if (!Number.isFinite(speed)) return DEFAULT_WALK_SPEED_KMH;
  return Math.min(6, Math.max(1, Math.round(speed)));
}
