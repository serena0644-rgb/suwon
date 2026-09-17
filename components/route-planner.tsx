"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GuidancePanel } from "@/components/map/guidance-panel";
import { RouteMap } from "@/components/map/route-map";
import type { MapPlace } from "@/components/map/route-map";
import { formatDistance, formatDuration } from "@/lib/routing/geo";
import { optimizeOrder } from "@/lib/routing/optimize";
import { DEFAULT_WALK_SPEED_KMH } from "@/lib/routing/constants";
import { useNavigation } from "@/lib/routing/use-navigation";
import { useWalkRoute } from "@/lib/routing/use-walk-route";
import { WALK_OPTION_LABELS } from "@/lib/routing/types";
import type { LatLng, WalkOption, WalkRoute } from "@/lib/routing/types";
import { saveCourse as persistCourse, readSaved } from "@/lib/selection";

const MAX_STOPS = 12;
const WALK_OPTIONS: WalkOption[] = [
  "no-stairs",
  "recommend",
  "main-road",
  "shortest",
];

/** 바깥 화면(주차장 카드 등)에서 지점을 담아 달라고 요청할 때 쓰는 값. token 이 바뀔 때만 반영됩니다. */
export type PickRequest = {
  place: MapPlace;
  token: number;
};

type RoutePlannerProps = {
  candidates: MapPlace[];
  /** 화면을 열었을 때 기본으로 담겨 있는 지점. */
  initialStops?: MapPlace[];
  pickRequest?: PickRequest | null;
};

export function RoutePlanner({
  candidates,
  initialStops = [],
  pickRequest = null,
}: RoutePlannerProps) {
  const [stops, setStops] = useState<MapPlace[]>(initialStops);
  const [candidateId, setCandidateId] = useState("");
  const [option, setOption] = useState<WalkOption>("no-stairs");
  const [fixStart, setFixStart] = useState(true);
  const [fixEnd, setFixEnd] = useState(false);
  const [guiding, setGuiding] = useState(false);
  // 재탐색 중에는 "이탈했을 때 보고 있던 경로" 를 담아 둡니다.
  // 새 경로가 도착하면 참조가 달라지므로, 별도의 플래그 없이 재탐색 종료를 알 수 있습니다.
  const [rerouteBase, setRerouteBase] = useState<WalkRoute | null>(null);
  const [notice, setNotice] = useState(
    "지도에서 장소를 누르거나 빈 곳을 눌러 방문할 지점을 담아 보세요.",
  );
  const [geoToken, setGeoToken] = useState(0);
  const customCounter = useRef(0);

  const { error, loading, message, refresh, route, source } = useWalkRoute(
    stops,
    option,
    DEFAULT_WALK_SPEED_KMH,
    stops.length >= 2,
  );

  const routeRef = useRef(route);
  useEffect(() => {
    routeRef.current = route;
  });

  const handleOffRoute = useCallback((position: LatLng, legIndex: number) => {
    setStops((previous) => {
      const remaining = previous.slice(legIndex + 1);
      if (remaining.length === 0) return previous;
      return [
        {
          id: `current-${Date.now()}`,
          kind: "custom",
          lat: position.lat,
          lng: position.lng,
          name: "현재 위치",
        },
        ...remaining,
      ];
    });
    setRerouteBase(routeRef.current);
    setNotice("경로를 벗어나 현재 위치에서 다시 탐색합니다.");
  }, []);

  const { geo, progress } = useNavigation(
    route,
    guiding,
    handleOffRoute,
    geoToken,
  );

  const rerouting = rerouteBase !== null && route === rerouteBase;

  // 지도 오버레이의 클릭 핸들러는 한 번만 등록되므로, 최신 stops 는 ref 로 읽습니다.
  const stopsRef = useRef(stops);
  useEffect(() => {
    stopsRef.current = stops;
  });

  const addPlace = useCallback((place: MapPlace) => {
    const current = stopsRef.current;
    if (current.length >= MAX_STOPS) {
      setNotice(`경유지는 최대 ${MAX_STOPS}곳까지 담을 수 있습니다.`);
      return;
    }
    if (current.some((stop) => stop.id === place.id)) {
      setNotice(`${place.name}은(는) 이미 선택 목록에 있습니다.`);
      return;
    }
    setStops([...current, place]);
    setNotice(
      `${place.name}을(를) ${current.length + 1}번째 지점으로 담았습니다.`,
    );
  }, []);

  const pickTokenRef = useRef(0);
  useEffect(() => {
    if (!pickRequest || pickRequest.token === pickTokenRef.current) return;
    pickTokenRef.current = pickRequest.token;
    addPlace(pickRequest.place);
  }, [addPlace, pickRequest]);

  const addMapPoint = useCallback(
    (point: LatLng) => {
      customCounter.current += 1;
      const index = customCounter.current;
      addPlace({
        id: `custom-${Date.now()}-${index}`,
        kind: "custom",
        lat: point.lat,
        lng: point.lng,
        name: `지도에서 선택한 지점 ${index}`,
        original: {
          id: `map-${Date.now()}-${index}`,
          name: `지도에서 선택한 지점 ${index}`,
          address: "",
          lat: point.lat,
          lng: point.lng,
          source: "map",
        },
      });
    },
    [addPlace],
  );

  function move(index: number, delta: number) {
    setStops((previous) => {
      const target = index + delta;
      if (target < 0 || target >= previous.length) return previous;
      const next = previous.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setNotice("방문 순서를 변경했습니다.");
  }

  function remove(index: number) {
    const target = stops[index];
    setStops(stops.filter((_, position) => position !== index));
    if (target) setNotice(`${target.name}을(를) 목록에서 뺐습니다.`);
  }

  function clearAll() {
    setStops([]);
    setGuiding(false);
    setNotice("선택 목록을 비웠습니다.");
  }

  function optimize() {
    if (stops.length < 4) {
      setNotice(
        "순서를 최적화하려면 4곳 이상 담아 주세요. 3곳 이하는 순서를 바꿔도 총 거리가 같습니다.",
      );
      return;
    }

    const result = optimizeOrder(stops, { fixEnd, fixStart });
    if (!result.improved) {
      setNotice("이미 총 이동거리가 가장 짧은 순서입니다.");
      return;
    }

    setStops(result.order.map((index) => stops[index]));
    const saved = result.originalTotal - result.total;
    setNotice(
      `방문 순서를 최적화했습니다. 직선 기준 총 이동거리가 ${formatDistance(saved)} 줄었습니다 (${formatDistance(result.originalTotal)} → ${formatDistance(result.total)}).`,
    );
  }

  function startGuiding() {
    if (!route) {
      setNotice("먼저 두 곳 이상을 담아 경로를 만들어 주세요.");
      return;
    }
    setGuiding(true);
    setNotice("실시간 안내를 시작합니다. 위치 권한을 허용해 주세요.");
  }

  function stopGuiding() {
    setGuiding(false);
    setRerouteBase(null);
    setNotice("안내를 종료했습니다.");
  }

  function saveCourse() {
    if (stops.length < 1) {
      setNotice("저장할 장소를 선택해 주세요.");
      return;
    }
    const places = stops.flatMap((stop) =>
      stop.original ? [stop.original] : [],
    );
    if (places.length !== stops.length) {
      setNotice("선택한 장소를 저장하지 못했습니다.");
      return;
    }
    const saved = persistCourse(places, readSaved().parking);
    setNotice(
      saved
        ? `"${saved.title}" 경로를 마이페이지에 저장했습니다.`
        : "저장하지 못했습니다.",
    );
  }

  const sourceNotice = useMemo(() => {
    if (error) return { tone: "danger" as const, text: error };
    if (source === "fallback" || source === "partial") {
      return {
        tone: "warn" as const,
        text: message ?? "일부 구간을 직선으로 표시합니다.",
      };
    }
    return null;
  }, [error, message, source]);

  return (
    <div className="route-planner">
      <div className="route-planner-map">
        <RouteMap
          activeLegIndex={guiding && progress ? progress.legIndex : -1}
          ariaLabel="경로 만들기 지도"
          candidates={candidates}
          followUser={guiding && Boolean(geo.position)}
          highlightStep={guiding ? (progress?.nextStep ?? null) : null}
          interactive={!guiding}
          onCandidateSelect={addPlace}
          onMapClick={addMapPoint}
          route={route}
          selected={stops}
          userPosition={
            geo.position ? { ...geo.position, accuracy: geo.accuracy } : null
          }
        />
        {loading && !rerouting && (
          <p className="route-map-badge">보행 경로를 탐색하는 중…</p>
        )}
      </div>

      <aside className="route-planner-side">
        {guiding && route ? (
          <GuidancePanel
            geo={geo}
            onExit={stopGuiding}
            onRetry={() => setGeoToken((token) => token + 1)}
            progress={progress}
            rerouting={rerouting}
            route={route}
          />
        ) : (
          <>
            <div className="planner-head">
              <h3>방문할 곳 고르기</h3>
              <p className="muted">
                지도의 마커를 누르면 그 장소가, 빈 곳을 누르면 그 지점이 목록에
                담깁니다. 담은 순서대로 이동합니다.
              </p>
            </div>

            <label className="planner-field">
              장소 추가
              <select
                value={candidateId}
                onChange={(event) => setCandidateId(event.target.value)}
              >
                <option value="">선택하지 않음</option>
                {candidates.map((place) => (
                  <option value={place.id} key={place.id}>
                    {place.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="small-btn"
              type="button"
              disabled={!candidateId}
              onClick={() => {
                const place = candidates.find(
                  (place) => place.id === candidateId,
                );
                if (place) addPlace(place);
              }}
            >
              선택 장소 담기
            </button>
            <label className="planner-field">
              보행 옵션
              <select
                value={option}
                onChange={(event) =>
                  setOption(event.target.value as WalkOption)
                }
              >
                {WALK_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {WALK_OPTION_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>

            <div className="planner-toggles">
              <label>
                <input
                  type="checkbox"
                  checked={fixStart}
                  onChange={(event) => setFixStart(event.target.checked)}
                />
                출발지 고정
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={fixEnd}
                  onChange={(event) => setFixEnd(event.target.checked)}
                />
                도착지 고정
              </label>
            </div>

            <ol className="planner-stops">
              {stops.map((stop, index) => (
                <li key={stop.id}>
                  <span className="planner-order">{index + 1}</span>
                  <div className="planner-stop-body">
                    <strong>{stop.name}</strong>
                    <small>
                      {index === 0
                        ? "출발"
                        : index === stops.length - 1
                          ? "도착"
                          : "경유"}
                      {stop.subtitle ? ` · ${stop.subtitle}` : ""}
                    </small>
                  </div>
                  <div className="planner-stop-actions">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`${stop.name} 순서 올리기`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === stops.length - 1}
                      aria-label={`${stop.name} 순서 내리기`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => remove(index)}
                      aria-label={`${stop.name} 삭제`}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
              {stops.length === 0 && (
                <li className="planner-empty">아직 담은 지점이 없습니다.</li>
              )}
            </ol>

            <div className="planner-actions">
              <button
                className="small-btn"
                type="button"
                onClick={optimize}
                disabled={stops.length < 3}
              >
                순서 자동 최적화
              </button>
              <button
                className="small-btn"
                type="button"
                onClick={refresh}
                disabled={stops.length < 2}
              >
                경로 다시 탐색
              </button>
              <button
                className="small-btn"
                type="button"
                onClick={clearAll}
                disabled={stops.length === 0}
              >
                전체 비우기
              </button>
            </div>

            {route && (
              <div className="planner-summary">
                <div>
                  <span>총 거리</span>
                  <strong>{formatDistance(route.distance)}</strong>
                </div>
                <div>
                  <span>예상 소요</span>
                  <strong>{formatDuration(route.duration)}</strong>
                </div>
                <div>
                  <span>경유지</span>
                  <strong>{stops.length}곳</strong>
                </div>
              </div>
            )}

            {route && route.warnings.length > 0 && (
              <ul className="planner-warnings" aria-label="무장애 주의 구간">
                {route.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}

            {sourceNotice && (
              <p
                className={`planner-notice is-${sourceNotice.tone}`}
                role="alert"
              >
                {sourceNotice.text}
              </p>
            )}

            <p className="planner-notice" role="status">
              {notice}
            </p>

            <div className="planner-cta">
              <button
                className="primary-action"
                type="button"
                onClick={startGuiding}
                disabled={!route || loading}
              >
                경로 안내 시작
              </button>
              <button
                className="secondary-action"
                type="button"
                onClick={saveCourse}
                disabled={!stops.length}
              >
                마이페이지에 저장
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
