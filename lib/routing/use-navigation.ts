"use client";

import { useEffect, useMemo, useRef } from "react";
import { buildNavigationIndex, computeProgress } from "./navigation";
import type { NavigationProgress } from "./navigation";
import { useGeolocation } from "./use-geolocation";
import type { GeolocationState } from "./use-geolocation";
import type { LatLng, WalkRoute } from "./types";

/** 이탈 판정이 연속으로 이만큼 이어져야 재탐색합니다. GPS 가 튀는 경우를 걸러냅니다. */
const OFF_ROUTE_STREAK = 3;
/** 재탐색 최소 간격(ms). */
const REROUTE_COOLDOWN_MS = 20_000;

export type NavigationState = {
  geo: GeolocationState;
  progress: NavigationProgress | null;
};

export function useNavigation(
  route: WalkRoute | null,
  active: boolean,
  onOffRoute?: (position: LatLng, legIndex: number) => void,
  retryToken = 0,
): NavigationState {
  const geo = useGeolocation(active, retryToken);
  const index = useMemo(() => (route ? buildNavigationIndex(route) : null), [route]);

  const progress = useMemo(() => {
    if (!route || !index || !geo.position) return null;
    return computeProgress(route, index, geo.position);
  }, [geo.position, index, route]);

  const streakRef = useRef(0);
  const lastRerouteRef = useRef(0);

  useEffect(() => {
    if (!active) {
      streakRef.current = 0;
      return;
    }
    if (!progress || !geo.position || !onOffRoute || progress.arrived || !progress.offRoute) {
      streakRef.current = 0;
      return;
    }

    streakRef.current += 1;
    if (streakRef.current < OFF_ROUTE_STREAK) return;
    if (Date.now() - lastRerouteRef.current < REROUTE_COOLDOWN_MS) return;

    streakRef.current = 0;
    lastRerouteRef.current = Date.now();
    onOffRoute(geo.position, progress.legIndex);
  }, [active, geo.position, onOffRoute, progress]);

  return { geo, progress };
}
