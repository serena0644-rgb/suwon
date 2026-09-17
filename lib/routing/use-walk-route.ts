"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoutePoint, WalkOption, WalkRoute, WalkRouteResponse, WalkRouteSource } from "./types";

type WalkRouteState = {
  error: string | null;
  loading: boolean;
  message: string | null;
  route: WalkRoute | null;
  source: WalkRouteSource | null;
};

const IDLE: WalkRouteState = { error: null, loading: false, message: null, route: null, source: null };

/** 좌표가 실제로 바뀌었을 때만 다시 조회하도록 만드는 키. */
function signatureOf(points: RoutePoint[], option: WalkOption, speed: number) {
  return `${option}:${speed}:${points.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join("|")}`;
}

export function useWalkRoute(points: RoutePoint[], option: WalkOption, speed: number, enabled = true) {
  const [state, setState] = useState<WalkRouteState>(IDLE);
  const [reloadToken, setReloadToken] = useState(0);
  const signature = signatureOf(points, option, speed);
  // 아래 조회 효과는 signature 가 바뀔 때만 돌지만, 그때 필요한 좌표는 항상 최신이어야 합니다.
  // 이 효과가 먼저 선언되어 있어 같은 렌더에서 조회 효과보다 먼저 실행됩니다.
  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  });

  useEffect(() => {
    if (!enabled || pointsRef.current.length < 2) {
      setState(IDLE);
      return;
    }

    const controller = new AbortController();
    setState({ ...IDLE, loading: true });

    fetch("/api/route/walk", {
      body: JSON.stringify({ option, points: pointsRef.current, speed }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as Partial<WalkRouteResponse> & { message?: string };
        if (controller.signal.aborted) return;
        if (!response.ok || !payload?.ok || !payload?.route) {
          throw new Error(payload?.message || "경로를 만들지 못했습니다.");
        }
        setState({
          error: null,
          loading: false,
          message: payload.message ?? null,
          route: payload.route,
          source: payload.source ?? null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          error: error instanceof Error ? error.message : "경로를 만들지 못했습니다.",
          loading: false,
          message: null,
          route: null,
          source: null,
        });
      });

    return () => controller.abort();
    // signature 에 좌표/옵션이 모두 반영되어 있어 points 배열 자체는 의존성에서 제외합니다.
  }, [enabled, option, reloadToken, signature, speed]);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, refresh };
}
