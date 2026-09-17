"use client";

import { useEffect, useState } from "react";
import type { LatLng } from "./types";

export type GeolocationStatus = "denied" | "error" | "idle" | "locating" | "tracking" | "unsupported";

export type GeolocationState = {
  accuracy: number;
  error: string | null;
  heading: number | null;
  position: LatLng | null;
  speed: number | null;
  status: GeolocationStatus;
  updatedAt: number | null;
};

const IDLE: GeolocationState = {
  accuracy: 0,
  error: null,
  heading: null,
  position: null,
  speed: null,
  status: "idle",
  updatedAt: null,
};

const LOCATING: GeolocationState = { ...IDLE, status: "locating" };

/** 추적 세션마다 결과를 따로 담아, 세션이 바뀌면 이전 결과를 자동으로 버립니다. */
type Reading = {
  sessionKey: string;
  state: GeolocationState;
};

function describe(error: GeolocationPositionError): { message: string; status: GeolocationStatus } {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return {
        message:
          "위치 권한이 거부되었습니다. 브라우저 주소창의 자물쇠 아이콘에서 위치 접근을 허용한 뒤 다시 시작해 주세요.",
        status: "denied",
      };
    case error.POSITION_UNAVAILABLE:
      return {
        message: "현재 위치를 확인할 수 없습니다. 실내라면 창가나 실외로 이동한 뒤 다시 시도해 주세요.",
        status: "error",
      };
    case error.TIMEOUT:
      return { message: "위치 확인이 지연되고 있습니다. GPS 신호를 받는 중입니다.", status: "locating" };
    default:
      return { message: "위치 정보를 가져오지 못했습니다.", status: "error" };
  }
}

/** 브라우저가 실시간 위치를 줄 수 없는 상황이면 그 이유를 돌려줍니다. */
function blockedReason(): string | null {
  if (typeof window === "undefined") return null;
  if (!navigator.geolocation) return "이 브라우저는 위치 안내를 지원하지 않습니다.";
  if (!window.isSecureContext) return "HTTPS 연결에서만 실시간 위치 안내를 사용할 수 있습니다.";
  return null;
}

/**
 * active 인 동안 watchPosition 으로 현재 위치를 추적합니다.
 * retryToken 값을 바꾸면 추적을 처음부터 다시 시작합니다(권한 거부 후 재시도용).
 *
 * 상태는 오직 geolocation 콜백에서만 갱신하고, 초기 "찾는 중" 상태는 렌더에서 유도합니다.
 */
export function useGeolocation(active: boolean, retryToken = 0): GeolocationState {
  const [reading, setReading] = useState<Reading | null>(null);
  const sessionKey = `${active}:${retryToken}`;

  useEffect(() => {
    if (!active || blockedReason()) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setReading({
          sessionKey,
          state: {
            accuracy: position.coords.accuracy ?? 0,
            error: null,
            heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
            position: { lat: position.coords.latitude, lng: position.coords.longitude },
            speed: Number.isFinite(position.coords.speed) ? position.coords.speed : null,
            status: "tracking",
            updatedAt: position.timestamp,
          },
        });
      },
      (error) => {
        const { message, status } = describe(error);
        setReading((previous) => {
          const current = previous?.sessionKey === sessionKey ? previous.state : null;
          // 이미 위치를 받은 뒤의 일시적인 타임아웃은 추적 상태를 유지합니다.
          if (current?.position && status === "locating") {
            return { sessionKey, state: { ...current, error: message } };
          }
          return { sessionKey, state: { ...IDLE, error: message, status } };
        });
      },
      { enableHighAccuracy: true, maximumAge: 2_000, timeout: 12_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [active, sessionKey]);

  if (!active) return IDLE;

  const blocked = blockedReason();
  if (blocked) return { ...IDLE, error: blocked, status: "unsupported" };

  return reading?.sessionKey === sessionKey ? reading.state : LOCATING;
}
