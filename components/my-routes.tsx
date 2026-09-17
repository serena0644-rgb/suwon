"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent, ReactNode } from "react";
import { GuidancePanel } from "@/components/map/guidance-panel";
import { RouteMap } from "@/components/map/route-map";
import { DEFAULT_WALK_SPEED_KMH } from "@/lib/routing/constants";
import { formatDistance, formatDuration } from "@/lib/routing/geo";
import { useNavigation } from "@/lib/routing/use-navigation";
import { useWalkRoute } from "@/lib/routing/use-walk-route";
import { WALK_OPTION_LABELS } from "@/lib/routing/types";
import type { LatLng, RoutePoint, WalkOption, WalkRoute } from "@/lib/routing/types";
import {
  defaultRoutes,
  getRoutesServerSnapshot,
  getRoutesSnapshot,
  makeGeneratedRoute,
  setGuideIntent,
  subscribeRoutes,
  takeGuideIntent,
  writeRoutes,
} from "@/lib/routes/storage";
import type { SavedRoute } from "@/lib/routes/storage";

export function MyRoutesPage() {
  const router = useRouter();
  const routes = useSyncExternalStore(subscribeRoutes, getRoutesSnapshot, getRoutesServerSnapshot);
  const [filter, setFilter] = useState("전체");
  const [notice, setNotice] = useState("저장한 경로 목록입니다.");

  const visibleRoutes = useMemo(() => {
    if (filter === "전체") return routes;
    return routes.filter((route) => route.kind === filter || route.profile.includes(filter));
  }, [filter, routes]);

  function persist(nextRoutes: SavedRoute[], nextNotice: string) {
    writeRoutes(nextRoutes);
    setNotice(nextNotice);
  }

  function createRoute() {
    const nextRoute = makeGeneratedRoute(routes.length + 1);
    persist([nextRoute, ...routes], `${nextRoute.title}을 추가했습니다. 상세에서 수정할 수 있습니다.`);
  }

  function removeRoute(id: string) {
    const target = routes.find((route) => route.id === id);
    persist(routes.filter((route) => route.id !== id), `${target?.title ?? "경로"}를 목록에서 삭제했습니다.`);
  }

  async function shareRoute(route: SavedRoute) {
    const url = `${window.location.origin}/mypage/routes/${route.id}`;
    if (navigator.clipboard) await navigator.clipboard.writeText(url);
    setNotice(`${route.title} 공유 링크를 클립보드에 복사했습니다.`);
  }

  function startRoute(route: SavedRoute) {
    // 실시간 안내는 상세 화면의 지도에서 이루어지므로, 안내 의도를 남기고 이동합니다.
    setGuideIntent(route.id);
    router.push(`/mypage/routes/${route.id}`);
  }

  return (
    <PageShell active="mypage">
      <main className="my-page-shell">
        <section className="my-hero-panel">
          <div>
            <p className="eyebrow">My page</p>
            <h1>마이페이지</h1>
            <p className="lead">직접 만든 경로와 저장한 추천 경로를 관리하고, 상세 화면에서 카카오맵 경로를 확인할 수 있습니다.</p>
          </div>
          <div className="profile-card">
            <span className="profile-avatar">S</span>
            <strong>수원 든든패스 사용자</strong>
            <p>휠체어 · 유모차 · 고령자 맞춤 경로를 함께 저장 중</p>
          </div>
        </section>

        <section className="route-list-section">
          <div className="route-list-header">
            <div>
              <h2>내 경로 목록</h2>
              <p>직접 만든 경로와 저장한 추천 경로 {routes.length}개</p>
            </div>
            <button className="primary-action" type="button" onClick={createRoute}>+ 새 경로 만들기</button>
          </div>

          <div className="my-summary-grid">
            <SummaryTile label="저장 경로" value={`${routes.length}개`} />
            <SummaryTile label="평균 소요" value="42분" />
            <SummaryTile label="무장애 A등급" value={`${routes.filter((route) => route.grade.startsWith("A")).length}개`} />
            <SummaryTile label="최근 수정" value="2025.09.10" />
          </div>

          <div className="route-filter-bar" aria-label="경로 필터">
            {["전체", "내가 만든 경로", "저장한 추천 경로", "휠체어", "유모차", "시각장애", "고령자"].map((item) => (
              <button className={filter === item ? "is-active" : ""} key={item} type="button" onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>

          <p className="route-notice" role="status">{notice}</p>

          <div className="saved-route-list">
            {visibleRoutes.map((route) => (
              <article className="saved-route-card" key={route.id}>
                <div className="saved-route-main">
                  <span className="badge soft">{route.kind}</span>
                  <h3>{route.title}</h3>
                  <p>{route.savedDate} 저장 · 최근 수정 {route.editedDate} · {route.profile}</p>
                  <div className="badge-row">
                    {route.tags.map((tag) => <span className="badge ok" key={tag}>{tag}</span>)}
                  </div>
                </div>
                <div className="saved-route-stats">
                  <strong>{route.distance}</strong>
                  <span>{route.duration}</span>
                  <span>{route.grade}</span>
                </div>
                <div className="saved-route-actions">
                  <button className="small-btn primary" type="button" onClick={() => startRoute(route)}>안내 시작</button>
                  <Link className="small-btn" href={`/mypage/routes/${route.id}`}>상세 보기</Link>
                  <button className="small-btn" type="button" onClick={() => shareRoute(route)}>공유</button>
                  <button className="small-btn danger" type="button" onClick={() => removeRoute(route.id)}>삭제</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </PageShell>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return <article className="summary-tile"><span>{label}</span><strong>{value}</strong></article>;
}

export function RouteDetailPage({ routeId }: { routeId: string }) {
  const routes = useSyncExternalStore(subscribeRoutes, getRoutesSnapshot, getRoutesServerSnapshot);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftMemo, setDraftMemo] = useState("");
  const [guiding, setGuiding] = useState(false);
  const [intentChecked, setIntentChecked] = useState(false);

  const route = routes.find((item) => item.id === routeId) ?? defaultRoutes.find((item) => item.id === routeId);

  // 목록에서 "안내 시작" 을 누르고 넘어온 경우 곧바로 안내를 켭니다.
  // 효과 대신 첫 렌더에서 한 번만 확인해, 지도가 안내 상태로 바로 그려지도록 했습니다.
  if (!intentChecked && typeof window !== "undefined") {
    setIntentChecked(true);
    if (takeGuideIntent(routeId)) setGuiding(true);
  }

  if (!route) {
    return (
      <PageShell active="mypage">
        <main className="my-page-shell">
          <section className="empty-route">
            <h1>경로를 찾을 수 없습니다</h1>
            <p className="muted">저장 목록에서 삭제되었거나 존재하지 않는 경로입니다.</p>
            <Link className="primary-action" href="/mypage">내 경로 목록으로</Link>
          </section>
        </main>
      </PageShell>
    );
  }

  const selectedRoute: SavedRoute = route;

  function persist(nextRoutes: SavedRoute[], nextNotice: string) {
    writeRoutes(nextRoutes);
    setNotice(nextNotice);
  }

  function openEditor() {
    setDraftTitle(selectedRoute.title);
    setDraftMemo(selectedRoute.memo);
    setEditing(true);
  }

  function updateRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRoutes = routes.map((item) => item.id === selectedRoute.id ? { ...item, title: draftTitle.trim() || item.title, memo: draftMemo.trim() || item.memo, editedDate: new Date().toISOString().slice(0, 10).replaceAll("-", ".") } : item);
    persist(nextRoutes, "경로 제목과 메모를 저장했습니다.");
    setEditing(false);
  }

  function deleteRoute() {
    persist(routes.filter((item) => item.id !== selectedRoute.id), `${selectedRoute.title}를 삭제했습니다.`);
  }

  async function shareRoute() {
    const url = `${window.location.origin}/mypage/routes/${selectedRoute.id}`;
    if (navigator.clipboard) await navigator.clipboard.writeText(url);
    setNotice("공유 링크를 클립보드에 복사했습니다.");
  }

  function startRoute() {
    setGuiding(true);
    setNotice(`${selectedRoute.title} 실시간 안내를 시작합니다. 위치 권한을 허용해 주세요.`);
  }

  return (
    <PageShell active="mypage">
      <main className="route-detail-shell">
        <Link className="back-link" href="/mypage">← 마이페이지 · 내 경로 목록으로</Link>

        <section className="route-detail-header">
          <div>
            <span className="badge soft">{selectedRoute.kind}</span>
            <h1>{selectedRoute.title}</h1>
            <p>{selectedRoute.savedDate} 저장 · 최근 수정 {selectedRoute.editedDate} · {selectedRoute.profile}</p>
          </div>
          <div className="detail-actions">
            <button className="primary-action" type="button" onClick={startRoute} disabled={guiding}>
              {guiding ? "안내 중" : "경로 안내 시작"}
            </button>
            <button className="small-btn" type="button" onClick={openEditor}>경로 수정</button>
            <button className="small-btn" type="button" onClick={shareRoute}>공유</button>
            <button className="small-btn danger" type="button" onClick={deleteRoute}>삭제</button>
          </div>
        </section>

        {notice && <p className="route-notice" role="status">{notice}</p>}

        <section className="detail-summary-card">
          <SummaryTile label="총 거리" value={selectedRoute.distance} />
          <SummaryTile label="예상 소요" value={selectedRoute.duration} />
          <SummaryTile label="경유지" value={`${selectedRoute.stops}곳`} />
          <SummaryTile label="무장애 등급" value={selectedRoute.grade} />
          <SummaryTile label="연계 주차장" value={selectedRoute.parking} />
        </section>

        <section className="detail-columns">
          <article className="map-card kakao-detail-card">
            <div className="card-title-row">
              <h2>실제 보행 경로</h2>
              <span>보행자 경로탐색 기준 · 경유지 {selectedRoute.waypoints.length}곳</span>
            </div>
            <RouteWalkPanel
              guiding={guiding}
              key={selectedRoute.id}
              onExitGuiding={() => setGuiding(false)}
              onStartGuiding={() => setGuiding(true)}
              route={selectedRoute}
            />
          </article>

          <article className="access-card">
            <h2>무장애 정보 요약</h2>
            <strong>무장애 등급 {selectedRoute.grade} · {selectedRoute.profile}</strong>
            <p>✅ 전 구간 경사 5% 이하 우선</p>
            <p>✅ 경사로 3곳 · 엘리베이터 2곳</p>
            <p>✅ 장애인 화장실 2곳 · 수유실 1곳</p>
            <p>⚠️ 벽화마을 초입 보도 폭 1.0m 주의</p>
            <p>ℹ️ 실시간 제보 2건 반영 · 2025.09.09</p>
          </article>
        </section>

        <section className="timeline-card">
          <div className="card-title-row"><h2>경유지 상세 ({selectedRoute.waypoints.length}곳)</h2><span>수정 버튼에서 제목과 메모를 바꿀 수 있습니다</span></div>
          {selectedRoute.waypoints.map((point) => (
            <article className="timeline-row" key={point.id}>
              <span className="timeline-num">{point.id}</span>
              <div>
                <h3>{point.name}<small>{point.role}</small></h3>
                <p>{point.meta}</p>
                <div className="badge-row">{point.tags.map((tag) => <span className="badge ok" key={tag}>{tag}</span>)}</div>
              </div>
              <strong>{point.next}</strong>
            </article>
          ))}
        </section>

        <section className="extra-columns">
          <article className="parking-link-card">
            <h2>연계 주차장</h2>
            <div className="parking-line"><span>P</span><div><strong>{selectedRoute.parking}</strong><p>{selectedRoute.parkingMeta}</p></div></div>
            <span className="badge ok">{selectedRoute.parkingStatus}</span>
            <Link className="card-link" href="/#parking">주차장 상세 보기 →</Link>
          </article>
          <article className="memo-card">
            <h2>내 메모</h2>
            <p>{selectedRoute.memo}</p>
            <button className="card-link" type="button" onClick={openEditor}>메모 수정 →</button>
          </article>
        </section>

        {editing && (
          <div className="edit-dialog" role="dialog" aria-modal="true" aria-label="경로 수정">
            <form className="edit-panel" onSubmit={updateRoute}>
              <h2>경로 수정</h2>
              <label>경로 이름<input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} /></label>
              <label>내 메모<textarea value={draftMemo} onChange={(event) => setDraftMemo(event.target.value)} /></label>
              <div className="dialog-actions">
                <button className="small-btn" type="button" onClick={() => setEditing(false)}>취소</button>
                <button className="primary-action" type="submit">저장</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </PageShell>
  );
}

/**
 * 저장된 경로의 경유지를 실제 보행 경로로 다시 그리고, 실시간 안내까지 담당합니다.
 * 기존에는 경유지를 Polyline 으로 직선 연결했지만, 무장애 경로에서는
 * 실제 통행 가능한 길이 아닌 선이 오히려 오해를 만들 수 있어 경로탐색 결과로 바꿨습니다.
 */
function RouteWalkPanel({
  guiding,
  onExitGuiding,
  onStartGuiding,
  route,
}: {
  guiding: boolean;
  onExitGuiding: () => void;
  onStartGuiding: () => void;
  route: SavedRoute;
}) {
  const stops = useMemo<RoutePoint[]>(
    () => route.waypoints.map((point) => ({ lat: point.lat, lng: point.lng, name: point.name })),
    [route],
  );

  const [option, setOption] = useState<WalkOption>(route.walkOption ?? "no-stairs");
  // 경로를 벗어나 재탐색할 때만 경유지가 바뀌므로, 저장된 경유지를 초기값으로 둡니다.
  // (경유지 자체가 달라지는 경우에는 부모가 key 를 바꿔 이 컴포넌트를 새로 만듭니다.)
  const [points, setPoints] = useState<RoutePoint[]>(stops);
  const [rerouteBase, setRerouteBase] = useState<WalkRoute | null>(null);
  const [geoToken, setGeoToken] = useState(0);

  const { error, loading, message, route: walkRoute, source } = useWalkRoute(
    points,
    option,
    DEFAULT_WALK_SPEED_KMH,
    points.length >= 2,
  );

  const walkRouteRef = useRef(walkRoute);
  useEffect(() => {
    walkRouteRef.current = walkRoute;
  });

  const handleOffRoute = useCallback((position: LatLng, legIndex: number) => {
    setPoints((previous) => {
      const remaining = previous.slice(legIndex + 1);
      if (remaining.length === 0) return previous;
      return [{ lat: position.lat, lng: position.lng, name: "현재 위치" }, ...remaining];
    });
    setRerouteBase(walkRouteRef.current);
  }, []);

  const { geo, progress } = useNavigation(walkRoute, guiding, handleOffRoute, geoToken);
  const rerouting = rerouteBase !== null && walkRoute === rerouteBase;

  function exitGuiding() {
    setPoints(stops);
    setRerouteBase(null);
    onExitGuiding();
  }

  const fallbackNotice = error ?? (source === "tmap" ? null : message);

  return (
    <div className="detail-walk-panel">
      <div className="detail-walk-map">
        <RouteMap
          activeLegIndex={guiding && progress ? progress.legIndex : -1}
          ariaLabel={`${route.title} 보행 경로 지도`}
          followUser={guiding && Boolean(geo.position)}
          highlightStep={guiding ? (progress?.nextStep ?? null) : null}
          route={walkRoute}
          selected={points}
          userPosition={geo.position ? { ...geo.position, accuracy: geo.accuracy } : null}
        />
        {loading && <p className="route-map-badge">보행 경로를 탐색하는 중…</p>}
      </div>

      <div className="detail-walk-meta">
        <label className="planner-field">
          보행 옵션
          <select value={option} onChange={(event) => setOption(event.target.value as WalkOption)}>
            {(["no-stairs", "recommend", "main-road", "shortest"] as WalkOption[]).map((value) => (
              <option key={value} value={value}>
                {WALK_OPTION_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        {walkRoute && (
          <div className="planner-summary">
            <div>
              <span>실제 보행거리</span>
              <strong>{formatDistance(walkRoute.distance)}</strong>
            </div>
            <div>
              <span>예상 소요</span>
              <strong>{formatDuration(walkRoute.duration)}</strong>
            </div>
          </div>
        )}

        {walkRoute && walkRoute.warnings.length > 0 && (
          <ul className="planner-warnings" aria-label="무장애 주의 구간">
            {walkRoute.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}

        {fallbackNotice && (
          <p className="planner-notice is-warn" role="alert">
            {fallbackNotice}
          </p>
        )}

        {!guiding && (
          <button className="primary-action" type="button" onClick={onStartGuiding} disabled={!walkRoute}>
            경로 안내 시작
          </button>
        )}
      </div>

      {guiding && walkRoute && (
        <GuidancePanel
          geo={geo}
          onExit={exitGuiding}
          onRetry={() => setGeoToken((token) => token + 1)}
          progress={progress}
          rerouting={rerouting}
          route={walkRoute}
        />
      )}
    </div>
  );
}

function PageShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <>
      <nav className="navbar">
        <Link href="/" className="brand">수원 든든패스</Link>
        <div className="nav-links">
          <Link href="/">홈</Link><Link href="/#parking">주차장</Link><Link href="/#route">경로 안내</Link><Link href="/#api">관광지</Link><Link className={active === "mypage" ? "active" : ""} href="/mypage">마이페이지</Link>
        </div>
        <div className="nav-actions"><Link className="nav-btn" href="/login">로그인</Link><Link className="nav-btn primary" href="/signup">회원가입</Link></div>
      </nav>
      {children}
      <div className="bottom-nav"><Link href="/">홈</Link><Link href="/#parking">주차장</Link><Link href="/#route">경로 안내</Link><Link href="/#api">관광지</Link><Link href="/#report">제보하기</Link><Link href="/mypage">마이페이지</Link></div>
      <footer><strong>수원 든든패스 | 수원시 관광 통합 정보 플랫폼</strong><span>© 2026 수원 든든패스</span></footer>
    </>
  );
}
