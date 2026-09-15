"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Waypoint = {
  id: number;
  name: string;
  role: string;
  meta: string;
  tags: string[];
  next: string;
};

type SavedRoute = {
  id: string;
  kind: string;
  title: string;
  savedDate: string;
  editedDate: string;
  profile: string;
  distance: string;
  duration: string;
  stops: number;
  grade: string;
  parking: string;
  parkingMeta: string;
  parkingStatus: string;
  tags: string[];
  memo: string;
  waypoints: Waypoint[];
};

const STORAGE_KEY = "suwon-ddp-routes";

const defaultRoutes: SavedRoute[] = [
  {
    id: "hwaseong-mural-walk",
    kind: "내가 만든 경로",
    title: "화성행궁 → 행궁동 벽화마을 산책",
    savedDate: "2025.09.02",
    editedDate: "2025.09.10",
    profile: "휠체어 이동 기준",
    distance: "2.4 km",
    duration: "52분",
    stops: 4,
    grade: "A (양호)",
    parking: "수원화성 제1주차장",
    parkingMeta: "출발지에서 50m · 도보 1분 · 장애인 구역 4면",
    parkingStatus: "실시간 잔여 45면 · 여유",
    tags: ["계단 우회로", "평지 우선", "화장실 2곳"],
    memo: "오후 2시 이후에는 공방거리 그늘 구간을 이용. 벽화마을 초입 경사가 있어 동행자 1명 필요.",
    waypoints: [
      { id: 1, name: "화성행궁", role: "출발", meta: "09:30 출발 예정 · 매표소 앞 집결", tags: ["경사로 진입", "장애인 화장실", "휠체어 대여"], next: "다음 구간 650m · 14분" },
      { id: 2, name: "행궁광장", role: "경유", meta: "휴식 10분 · 광장 그늘 쉼터", tags: ["평지", "그늘 쉼터", "수유실"], next: "다음 구간 700m · 15분" },
      { id: 3, name: "공방거리", role: "경유", meta: "체험 30분 · 보도 폭 1.5m 이상", tags: ["계단 우회로", "턱 없음"], next: "다음 구간 1.1km · 23분" },
      { id: 4, name: "행궁동 벽화마을", role: "도착", meta: "11:20 도착 예정 · 일부 구간 경사 8%", tags: ["사진 확인됨", "주의 구간"], next: "도착" },
    ],
  },
  {
    id: "jang-an-gate-loop",
    kind: "저장한 추천 경로",
    title: "장안문 순환 무장애 코스",
    savedDate: "2025.08.22",
    editedDate: "2025.08.25",
    profile: "고령자 이동 기준",
    distance: "1.8 km",
    duration: "38분",
    stops: 3,
    grade: "A- (양호)",
    parking: "장안문 공영주차장",
    parkingMeta: "출발지에서 120m · 도보 3분 · 엘리베이터 연계",
    parkingStatus: "실시간 잔여 12면 · 보통",
    tags: ["짧은 동선", "휴식 3곳", "경사 낮음"],
    memo: "오전 시간대 추천. 장안문 북측 포토존 주변은 주말에 혼잡합니다.",
    waypoints: [
      { id: 1, name: "장안문", role: "출발", meta: "10:00 출발 예정 · 북측 안내판 앞", tags: ["평지", "벤치"], next: "다음 구간 500m · 11분" },
      { id: 2, name: "화홍문", role: "경유", meta: "휴식 15분 · 수변 쉼터", tags: ["그늘 쉼터", "사진 명소"], next: "다음 구간 800m · 18분" },
      { id: 3, name: "장안공원", role: "도착", meta: "10:45 도착 예정", tags: ["화장실", "대중교통 연계"], next: "도착" },
    ],
  },
  {
    id: "haenggung-family",
    kind: "내가 만든 경로",
    title: "행궁광장 가족 휴식 코스",
    savedDate: "2025.08.11",
    editedDate: "2025.08.18",
    profile: "유모차 이동 기준",
    distance: "1.2 km",
    duration: "31분",
    stops: 3,
    grade: "A (양호)",
    parking: "행궁 광장 주차장",
    parkingMeta: "출발지에서 80m · 도보 2분 · 수유실 인접",
    parkingStatus: "실시간 잔여 8면 · 혼잡",
    tags: ["수유실", "그늘 쉼터", "짧은 거리"],
    memo: "점심 이후 광장이 붐비면 관광안내소 뒤편 보행로를 이용하세요.",
    waypoints: [
      { id: 1, name: "행궁광장", role: "출발", meta: "13:00 출발 예정 · 서측 진입부", tags: ["수유실", "평지"], next: "다음 구간 350m · 8분" },
      { id: 2, name: "관광안내소", role: "경유", meta: "기저귀 교환대 확인", tags: ["수유실", "화장실"], next: "다음 구간 520m · 13분" },
      { id: 3, name: "화성행궁", role: "도착", meta: "13:30 도착 예정", tags: ["경사로", "그늘"], next: "도착" },
    ],
  },
  {
    id: "pal-dal-access",
    kind: "저장한 추천 경로",
    title: "팔달문 주변 저시력 안내 코스",
    savedDate: "2025.07.29",
    editedDate: "2025.08.03",
    profile: "시각장애 이동 기준",
    distance: "2.0 km",
    duration: "47분",
    stops: 4,
    grade: "B+ (주의)",
    parking: "팔달문 공영주차장",
    parkingMeta: "출발지에서 180m · 도보 5분 · 횡단보도 2회",
    parkingStatus: "실시간 잔여 19면 · 보통",
    tags: ["음성 안내", "횡단 주의", "동행 추천"],
    memo: "팔달문 시장 입구는 유도블록 단절 구간이 있어 우회 동선을 유지하세요.",
    waypoints: [
      { id: 1, name: "팔달문", role: "출발", meta: "14:00 출발 예정 · 동측 횡단보도", tags: ["음향신호기", "횡단 주의"], next: "다음 구간 420m · 10분" },
      { id: 2, name: "시장 입구", role: "경유", meta: "혼잡 구간 · 동행 권장", tags: ["유도블록 단절", "주의"], next: "다음 구간 600m · 16분" },
      { id: 3, name: "남문로", role: "경유", meta: "보행 폭 1.4m", tags: ["평지", "차도 인접"], next: "다음 구간 980m · 21분" },
      { id: 4, name: "행궁광장", role: "도착", meta: "14:50 도착 예정", tags: ["넓은 광장", "휴식"], next: "도착" },
    ],
  },
];

function readRoutes(): SavedRoute[] {
  if (typeof window === "undefined") return defaultRoutes;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultRoutes;
  try {
    const parsed = JSON.parse(raw) as SavedRoute[];
    return parsed.length ? parsed : defaultRoutes;
  } catch {
    return defaultRoutes;
  }
}

function writeRoutes(routes: SavedRoute[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}

function makeGeneratedRoute(index: number): SavedRoute {
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", ".");
  return {
    ...defaultRoutes[0],
    id: `custom-${Date.now()}`,
    kind: "내가 만든 경로",
    title: `새 무장애 경로 ${index}`,
    savedDate: today,
    editedDate: today,
    profile: "휠체어 이동 기준",
    memo: "새 경로 메모를 입력해 주세요.",
  };
}

export function MyRoutesPage() {
  const [routes, setRoutes] = useState(defaultRoutes);
  const [filter, setFilter] = useState("전체");
  const [notice, setNotice] = useState("최근 저장한 경로 4개를 불러왔습니다.");

  useEffect(() => setRoutes(readRoutes()), []);

  const visibleRoutes = useMemo(() => {
    if (filter === "전체") return routes;
    return routes.filter((route) => route.kind === filter || route.profile.includes(filter));
  }, [filter, routes]);

  function persist(nextRoutes: SavedRoute[], nextNotice: string) {
    setRoutes(nextRoutes);
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
    setNotice(`${route.title} 안내를 시작했습니다. 첫 경유지는 ${route.waypoints[0]?.name ?? "출발지"}입니다.`);
  }

  return (
    <PageShell active="mypage">
      <main className="my-page-shell">
        <section className="my-hero-panel">
          <div>
            <p className="eyebrow">My page</p>
            <h1>마이페이지</h1>
            <p className="lead">직접 만든 경로와 저장한 추천 경로를 관리하고, 현장에서 바로 안내를 시작할 수 있습니다.</p>
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
  const [routes, setRoutes] = useState(defaultRoutes);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftMemo, setDraftMemo] = useState("");

  useEffect(() => setRoutes(readRoutes()), []);

  const route = routes.find((item) => item.id === routeId) ?? defaultRoutes.find((item) => item.id === routeId);

  useEffect(() => {
    if (!route) return;
    setDraftTitle(route.title);
    setDraftMemo(route.memo);
  }, [route]);

  if (!route) {
    return (
      <PageShell active="mypage">
        <main className="my-page-shell"><section className="empty-route"><h1>경로를 찾을 수 없습니다</h1><Link className="primary-action" href="/mypage">내 경로 목록으로</Link></section></main>
      </PageShell>
    );
  }

  function persist(nextRoutes: SavedRoute[], nextNotice: string) {
    setRoutes(nextRoutes);
    writeRoutes(nextRoutes);
    setNotice(nextNotice);
  }

  function updateRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRoutes = routes.map((item) => item.id === route.id ? { ...item, title: draftTitle.trim() || item.title, memo: draftMemo.trim() || item.memo, editedDate: new Date().toISOString().slice(0, 10).replaceAll("-", ".") } : item);
    persist(nextRoutes, "경로 제목과 메모를 저장했습니다.");
    setEditing(false);
  }

  function deleteRoute() {
    persist(routes.filter((item) => item.id !== route.id), `${route.title}를 삭제했습니다.`);
  }

  async function shareRoute() {
    const url = `${window.location.origin}/mypage/routes/${route.id}`;
    if (navigator.clipboard) await navigator.clipboard.writeText(url);
    setNotice("공유 링크를 클립보드에 복사했습니다.");
  }

  function startRoute() {
    setNotice(`${route.title} 안내를 시작했습니다. ${route.waypoints[0]?.name ?? "출발지"}에서 출발하세요.`);
  }

  return (
    <PageShell active="mypage">
      <main className="route-detail-shell">
        <Link className="back-link" href="/mypage">← 마이페이지 · 내 경로 목록으로</Link>

        <section className="route-detail-header">
          <div>
            <span className="badge soft">{route.kind}</span>
            <h1>{route.title}</h1>
            <p>{route.savedDate} 저장 · 최근 수정 {route.editedDate} · {route.profile}</p>
          </div>
          <div className="detail-actions">
            <button className="primary-action" type="button" onClick={startRoute}>경로 안내 시작</button>
            <button className="small-btn" type="button" onClick={() => setEditing(true)}>경로 수정</button>
            <button className="small-btn" type="button" onClick={shareRoute}>공유</button>
            <button className="small-btn danger" type="button" onClick={deleteRoute}>삭제</button>
          </div>
        </section>

        {notice && <p className="route-notice" role="status">{notice}</p>}

        <section className="detail-summary-card">
          <SummaryTile label="총 거리" value={route.distance} />
          <SummaryTile label="예상 소요" value={route.duration} />
          <SummaryTile label="경유지" value={`${route.stops}곳`} />
          <SummaryTile label="무장애 등급" value={route.grade} />
          <SummaryTile label="연계 주차장" value={route.parking} />
        </section>

        <section className="detail-columns">
          <article className="map-card">
            <div className="card-title-row"><h2>경로 미리보기</h2><span>무장애 경로 · 계단 구간 자동 회피</span></div>
            <div className="route-map-preview" aria-label="약식 경로 지도">
              <span className="map-caption">수원화성 일대 (약식 지도)</span>
              <i className="road horizontal" /><i className="road vertical" /><i className="zone" />
              <i className="route-seg seg-1" /><i className="route-seg seg-2" /><i className="route-seg seg-3" /><i className="route-seg seg-4" /><i className="route-seg seg-5" />
              {route.waypoints.slice(0, 4).map((point, index) => <span className={`map-stop stop-${index + 1}`} key={point.id}><b>{index + 1}</b><em>{point.name}</em></span>)}
            </div>
          </article>

          <article className="access-card">
            <h2>무장애 정보 요약</h2>
            <strong>무장애 등급 {route.grade} · {route.profile}</strong>
            <p>✅ 전 구간 경사 5% 이하 우선</p>
            <p>✅ 경사로 3곳 · 엘리베이터 2곳</p>
            <p>✅ 장애인 화장실 2곳 · 수유실 1곳</p>
            <p>⚠️ 벽화마을 초입 보도 폭 1.0m 주의</p>
            <p>ℹ️ 실시간 제보 2건 반영 · 2025.09.09</p>
          </article>
        </section>

        <section className="timeline-card">
          <div className="card-title-row"><h2>경유지 상세 ({route.waypoints.length}곳)</h2><span>수정 버튼에서 제목과 메모를 바꿀 수 있습니다</span></div>
          {route.waypoints.map((point) => (
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
            <div className="parking-line"><span>P</span><div><strong>{route.parking}</strong><p>{route.parkingMeta}</p></div></div>
            <span className="badge ok">{route.parkingStatus}</span>
            <Link className="card-link" href="/#parking">주차장 상세 보기 →</Link>
          </article>
          <article className="memo-card">
            <h2>내 메모</h2>
            <p>{route.memo}</p>
            <button className="card-link" type="button" onClick={() => setEditing(true)}>메모 수정 →</button>
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

function PageShell({ active, children }: { active: string; children: React.ReactNode }) {
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
