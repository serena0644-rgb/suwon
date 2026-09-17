"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadKakaoMaps } from "@/lib/kakao/loader";
import type {
  KakaoCircle,
  KakaoCustomOverlay,
  KakaoLatLng,
  KakaoMap,
  KakaoMaps,
  KakaoMouseEvent,
  KakaoPolyline,
} from "@/lib/kakao/types";
import { getKakaoMapAppKey } from "@/lib/env";
import type {
  LatLng,
  RoutePoint,
  RouteStep,
  WalkRoute,
} from "@/lib/routing/types";

export type MapPlaceKind = "custom" | "parking" | "tour";

export type MapPlace = RoutePoint & {
  original?: import("@/lib/selection").Place;
  id: string;
  kind: MapPlaceKind;
  subtitle?: string;
};

export type UserPosition = LatLng & {
  accuracy: number;
};

type RouteMapProps = {
  /** 안내 중인 구간. 해당 구간만 강조해서 그립니다. */
  activeLegIndex?: number;
  ariaLabel: string;
  /** 지도에서 눌러 선택할 수 있는 후보 장소(주차장·관광지). */
  candidates?: MapPlace[];
  center?: LatLng;
  className?: string;
  /** true 이면 사용자 위치가 바뀔 때마다 지도를 따라 움직입니다. */
  followUser?: boolean;
  /** 다음 안내 지점. 지도에 별도 표시합니다. */
  highlightStep?: RouteStep | null;
  /** 빈 지도를 클릭해 지점을 추가할 수 있는지 여부. */
  interactive?: boolean;
  level?: number;
  onCandidateSelect?: (place: MapPlace) => void;
  onMapClick?: (point: LatLng) => void;
  route?: WalkRoute | null;
  selected?: RoutePoint[];
  userPosition?: UserPosition | null;
};

const DEFAULT_CENTER: LatLng = { lat: 37.281889, lng: 127.014028 };
const ROUTE_COLOR = "#1a61d1";
const ROUTE_DIM_COLOR = "#9db6dd";
const FALLBACK_COLOR = "#ff8c2e";

export function RouteMap({
  activeLegIndex = -1,
  ariaLabel,
  candidates = [],
  center,
  className,
  followUser = false,
  highlightStep = null,
  interactive = false,
  level = 4,
  onCandidateSelect,
  onMapClick,
  route = null,
  selected = [],
  userPosition = null,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<KakaoMaps | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const candidateOverlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const selectedOverlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const polylinesRef = useRef<KakaoPolyline[]>([]);
  const userOverlayRef = useRef<KakaoCustomOverlay | null>(null);
  const userCircleRef = useRef<KakaoCircle | null>(null);
  const stepOverlayRef = useRef<KakaoCustomOverlay | null>(null);
  const lastFitRef = useRef("");

  // 지도 클릭 핸들러는 SDK 에 한 번만 등록하므로, 최신 콜백은 ref 로 읽습니다.
  const mapClickRef = useRef(onMapClick);
  const interactiveRef = useRef(interactive);
  useEffect(() => {
    mapClickRef.current = onMapClick;
    interactiveRef.current = interactive;
  });

  const [status, setStatus] = useState<"error" | "loading" | "ready">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadKakaoMaps(getKakaoMapAppKey())
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;
        mapRef.current = new maps.Map(containerRef.current, {
          center: new maps.LatLng(
            center?.lat ?? DEFAULT_CENTER.lat,
            center?.lng ?? DEFAULT_CENTER.lng,
          ),
          level,
        });
        maps.event.addListener(
          mapRef.current,
          "click",
          (event: KakaoMouseEvent) => {
            if (
              !interactiveRef.current ||
              !mapClickRef.current ||
              !event?.latLng
            )
              return;
            mapClickRef.current({
              lat: event.latLng.getLat(),
              lng: event.latLng.getLng(),
            });
          },
        );
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "지도를 불러오지 못했습니다.",
        );
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // 지도 인스턴스는 한 번만 만들고, 이후 center/level 변경은 아래 효과에서 처리합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toLatLng = useCallback((point: LatLng): KakaoLatLng | null => {
    const maps = mapsRef.current;
    if (!maps) return null;
    return new maps.LatLng(point.lat, point.lng);
  }, []);

  // 후보 장소 마커
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== "ready" || !maps || !map) return;

    candidateOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
    candidateOverlaysRef.current = candidates
      .filter(
        (place) =>
          !selected.some(
            (point) => point.lat === place.lat && point.lng === place.lng,
          ),
      )
      .map((place) => {
        const element = document.createElement("button");
        element.type = "button";
        element.className = `map-pin map-pin-${place.kind}`;
        element.title = place.name;
        element.setAttribute("aria-label", `${place.name} 경로에 추가`);
        element.innerHTML = `<span>${place.kind === "parking" ? "P" : "관"}</span><small>${escapeHtml(place.name)}</small>`;
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          onCandidateSelect?.(place);
        });

        return new maps.CustomOverlay({
          clickable: true,
          content: element,
          map,
          position: new maps.LatLng(place.lat, place.lng),
          yAnchor: 1,
          zIndex: 2,
        });
      });

    return () => {
      candidateOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
      candidateOverlaysRef.current = [];
    };
  }, [candidates, onCandidateSelect, selected, status]);

  // 선택한 지점(방문 순서) 마커
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== "ready" || !maps || !map) return;

    selectedOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
    selectedOverlaysRef.current = selected.map((point, index) => {
      const element = document.createElement("div");
      const role =
        index === 0 ? "start" : index === selected.length - 1 ? "goal" : "via";
      element.className = `map-stop map-stop-${role}`;
      element.innerHTML = `<span>${index + 1}</span><small>${escapeHtml(point.name)}</small>`;

      return new maps.CustomOverlay({
        content: element,
        map,
        position: new maps.LatLng(point.lat, point.lng),
        yAnchor: 1,
        zIndex: 4,
      });
    });

    return () => {
      selectedOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
      selectedOverlaysRef.current = [];
    };
  }, [selected, status]);

  // 실제 보행 경로 폴리라인 (구간별로 그려서 현재 구간을 강조합니다)
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== "ready" || !maps || !map) return;

    polylinesRef.current.forEach((line) => line.setMap(null));
    polylinesRef.current = [];

    if (route && route.legs.length > 0) {
      polylinesRef.current = route.legs
        .filter((leg) => leg.path.length > 1)
        .map((leg, index) => {
          const dimmed = activeLegIndex >= 0 && index !== activeLegIndex;
          return new maps.Polyline({
            map,
            path: leg.path.map(
              (point) => new maps.LatLng(point.lat, point.lng),
            ),
            strokeColor: leg.fallback
              ? FALLBACK_COLOR
              : dimmed
                ? ROUTE_DIM_COLOR
                : ROUTE_COLOR,
            strokeOpacity: dimmed ? 0.55 : 0.9,
            // 실제 보행로를 못 받은 구간은 점선으로 구분해서 오해를 줄입니다.
            strokeStyle: leg.fallback ? "shortdash" : "solid",
            strokeWeight: dimmed ? 4 : 6,
            zIndex: dimmed ? 1 : 3,
          });
        });
    }

    return () => {
      polylinesRef.current.forEach((line) => line.setMap(null));
      polylinesRef.current = [];
    };
  }, [activeLegIndex, route, status]);

  // 현재 위치
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== "ready" || !maps || !map) return;

    if (!userPosition) {
      userOverlayRef.current?.setMap(null);
      userCircleRef.current?.setMap(null);
      userOverlayRef.current = null;
      userCircleRef.current = null;
      return;
    }

    const position = new maps.LatLng(userPosition.lat, userPosition.lng);

    if (!userOverlayRef.current) {
      const element = document.createElement("div");
      element.className = "map-user-dot";
      element.setAttribute("aria-hidden", "true");
      userOverlayRef.current = new maps.CustomOverlay({
        content: element,
        map,
        position,
        zIndex: 6,
      });
    } else {
      userOverlayRef.current.setPosition(position);
      userOverlayRef.current.setMap(map);
    }

    const accuracy = Math.min(120, Math.max(12, userPosition.accuracy || 25));
    if (!userCircleRef.current) {
      userCircleRef.current = new maps.Circle({
        center: position,
        fillColor: "#1a61d1",
        fillOpacity: 0.12,
        map,
        radius: accuracy,
        strokeColor: "#1a61d1",
        strokeOpacity: 0.35,
        strokeStyle: "solid",
        strokeWeight: 1,
      });
    } else {
      userCircleRef.current.setPosition(position);
      userCircleRef.current.setRadius(accuracy);
      userCircleRef.current.setMap(map);
    }

    if (followUser) map.panTo(position);
  }, [followUser, status, userPosition]);

  // 다음 안내 지점
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== "ready" || !maps || !map) return;

    if (!highlightStep) {
      stepOverlayRef.current?.setMap(null);
      stepOverlayRef.current = null;
      return;
    }

    const position = new maps.LatLng(
      highlightStep.position.lat,
      highlightStep.position.lng,
    );
    const element = document.createElement("div");
    element.className = `map-step map-step-${highlightStep.kind}`;
    element.innerHTML = `<span>${escapeHtml(stepIcon(highlightStep.kind))}</span><small>${escapeHtml(highlightStep.description)}</small>`;

    stepOverlayRef.current?.setMap(null);
    stepOverlayRef.current = new maps.CustomOverlay({
      content: element,
      map,
      position,
      yAnchor: 1.1,
      zIndex: 5,
    });

    return () => {
      stepOverlayRef.current?.setMap(null);
      stepOverlayRef.current = null;
    };
  }, [highlightStep, status]);

  // 경로/선택이 바뀌었을 때만 화면 범위를 다시 맞춥니다. 안내 중에는 사용자 위치를 따라가므로 건너뜁니다.
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== "ready" || !maps || !map || followUser) return;

    const points: LatLng[] = route?.path.length ? route.path : selected;
    const signature = `${points.length}:${points[0]?.lat ?? 0},${points[0]?.lng ?? 0}:${points[points.length - 1]?.lat ?? 0},${points[points.length - 1]?.lng ?? 0}`;
    if (points.length === 0 || signature === lastFitRef.current) return;
    lastFitRef.current = signature;

    if (points.length === 1) {
      map.setCenter(new maps.LatLng(points[0].lat, points[0].lng));
      map.setLevel(4);
      return;
    }

    const bounds = new maps.LatLngBounds();
    points.forEach((point) =>
      bounds.extend(new maps.LatLng(point.lat, point.lng)),
    );
    map.setBounds(bounds, 60, 60, 60, 60);
  }, [followUser, route, selected, status]);

  // 외부에서 중심을 지정하면 따라갑니다.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map || !center) return;
    const latlng = toLatLng(center);
    if (latlng) map.setCenter(latlng);
  }, [center, status, toLatLng]);

  return (
    <div className={`route-map-shell ${className ?? ""}`.trim()}>
      <div
        className="route-map-canvas"
        ref={containerRef}
        role="application"
        aria-label={ariaLabel}
      />
      {status === "loading" && (
        <div className="map-fallback">카카오맵을 불러오는 중입니다.</div>
      )}
      {status === "error" && (
        <div className="map-fallback map-fallback-error">
          <strong>지도를 표시할 수 없습니다</strong>
          <p>{errorMessage}</p>
          <p className="muted">
            NEXT_PUBLIC_KAKAO_MAP_APP_KEY 를 설정하고 카카오 개발자 콘솔에 현재
            도메인을 등록해 주세요.
          </p>
        </div>
      )}
    </div>
  );
}

export function stepIcon(kind: RouteStep["kind"]): string {
  switch (kind) {
    case "crosswalk":
      return "🚸";
    case "goal":
      return "🏁";
    case "overpass":
      return "🌉";
    case "ramp":
      return "♿";
    case "stairs":
      return "⚠️";
    case "start":
      return "📍";
    case "turn":
      return "↪";
    case "underpass":
      return "🚇";
    case "waypoint":
      return "🔵";
    default:
      return "↑";
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
