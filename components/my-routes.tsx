"use client";
import { useSaved } from "@/lib/use-saved";
import { KAKAO_MAP_KEY } from "@/lib/kakao";
import Link from "next/link";
import Script from "next/script";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  readSaved,
  writeSaved,
  type SavedCourse,
  type Place,
} from "@/lib/selection";
const MAP_KEY = KAKAO_MAP_KEY;
function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="navbar">
        <Link className="brand" href="/">
          수원 든든패스
        </Link>
        <div className="nav-links">
          <Link href="/">홈</Link>
          <Link href="/#parking">주차장</Link>
          <Link href="/#route">경로 안내</Link>
          <Link href="/mypage">마이페이지</Link>
        </div>
      </nav>
      {children}
      <div className="bottom-nav">
        <Link href="/">홈</Link>
        <Link href="/#parking">주차장</Link>
        <Link href="/#route">경로 안내</Link>
        <Link href="/#facility">시설 안내</Link>
        <Link href="/#report">제보하기</Link>
        <Link href="/mypage">마이페이지</Link>
      </div>
    </>
  );
}
function guide(place: Place) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lng}`;
}
export function MyRoutesPage() {
  const saved = useSaved();
  const routes = saved.courses;
  const parking = saved.parking;
  const [notice, setNotice] = useState("");
  function remove(id: string) {
    const next = routes.filter((route) => route.id !== id);
    if (writeSaved({ ...readSaved(), courses: next })) {
      setNotice("코스를 삭제했습니다.");
    } else setNotice("변경사항을 저장하지 못했습니다.");
  }
  async function share(route: SavedCourse) {
    // Local-only data is not published by copying a URL. Share the actual selected places.
    const text = [
      route.title,
      ...route.places.map((place) => `${place.name}: ${guide(place)}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice("장소 목록과 지도 링크를 복사했습니다.");
    } catch {
      setNotice("클립보드에 복사하지 못했습니다.");
    }
  }
  return (
    <Shell>
      <main className="my-page-shell">
        <section className="my-hero-panel">
          <h1>마이페이지</h1>
        </section>
        <section className="route-list-section">
          <div className="route-list-header">
            <h2>내 코스 목록 · {routes.length}개</h2>
            <Link className="primary-action" href="/#route">
              새 코스 만들기
            </Link>
          </div>
          <p role="status">{notice}</p>
          {!routes.length && <p className="muted">저장된 코스가 없습니다.</p>}
          <div className="saved-route-list">
            {routes.map((route) => (
              <article className="saved-route-card" key={route.id}>
                <div className="saved-route-main">
                  <h3>{route.title}</h3>
                  <p>
                    {new Date(route.createdAt).toLocaleDateString("ko-KR")} 저장
                    · 장소 {route.places.length}곳
                  </p>
                </div>
                <div className="saved-route-actions">
                  <a
                    className="small-btn primary"
                    href={guide(route.places[0])}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    길안내
                  </a>
                  <Link
                    className="small-btn"
                    href={`/mypage/routes/${route.id}`}
                  >
                    상세 보기
                  </Link>
                  <button className="small-btn" onClick={() => share(route)}>
                    공유
                  </button>
                  <button
                    className="small-btn danger"
                    onClick={() => remove(route.id)}
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section>
          <h2>나의 주차장</h2>
          {parking ? (
            <>
              <h3>{parking.name}</h3>
              <p>{parking.address}</p>
              <a
                className="small-btn primary"
                href={guide(parking)}
                target="_blank"
                rel="noopener noreferrer"
              >
                길안내
              </a>
              <button
                className="small-btn"
                onClick={() => {
                  if (!writeSaved({ ...readSaved(), parking: null }))
                    setNotice("변경사항을 저장하지 못했습니다.");
                }}
              >
                저장 삭제
              </button>
            </>
          ) : (
            <p className="muted">저장된 주차장이 없습니다.</p>
          )}
        </section>
      </main>
    </Shell>
  );
}
export function RouteDetailPage({ routeId }: { routeId: string }) {
  const saved = useSaved();
  const route = saved.courses.find((course) => course.id === routeId) || null;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [notice, setNotice] = useState("");
  function update(event: FormEvent) {
    event.preventDefault();
    if (!route || !title.trim()) return;
    const next = { ...route, title: title.trim(), memo };
    if (
      writeSaved({
        ...readSaved(),
        courses: readSaved().courses.map((course) =>
          course.id === routeId ? next : course,
        ),
      })
    ) {
      setEditing(false);
      setNotice("코스를 수정했습니다.");
    } else setNotice("코스를 저장하지 못했습니다.");
  }
  return (
    <Shell>
      <main className="route-detail-shell">
        <Link href="/mypage">마이페이지로</Link>
        {!route ? (
          <section className="empty-route">
            <h1>{"저장된 코스가 없습니다"}</h1>
          </section>
        ) : (
          <>
            <section className="route-detail-header">
              <h1>{route.title}</h1>
              <div className="detail-actions">
                <button
                  className="small-btn"
                  onClick={() => {
                    setTitle(route.title);
                    setMemo(route.memo);
                    setEditing(!editing);
                  }}
                >
                  코스 수정
                </button>
                <button
                  className="small-btn danger"
                  onClick={() => {
                    if (
                      !writeSaved({
                        ...readSaved(),
                        courses: readSaved().courses.filter(
                          (course) => course.id !== routeId,
                        ),
                      })
                    )
                      setNotice("코스를 삭제하지 못했습니다.");
                  }}
                >
                  삭제
                </button>
              </div>
            </section>
            <p role="status">{notice}</p>
            {editing && (
              <form className="auth-form" onSubmit={update}>
                <label>
                  코스 이름
                  <input
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
                <label>
                  내 메모
                  <textarea
                    value={memo}
                    onChange={(event) => setMemo(event.target.value)}
                  />
                </label>
                <button className="primary-action" type="submit">
                  저장
                </button>
              </form>
            )}
            <section className="detail-columns">
              <div>
                <h2>선택한 장소 지도</h2>
                <CourseMap course={route} />
              </div>
              <div>
                <h2>방문 장소</h2>
                {route.places.map((place) => (
                  <article
                    className="timeline-row"
                    key={`${place.source}-${place.id}`}
                  >
                    <div>
                      <h3>{place.name}</h3>
                      <p>{place.address}</p>
                      {place.phone && <p>{place.phone}</p>}
                      <a
                        className="small-btn primary"
                        href={guide(place)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        길안내
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section>
              <h2>연계 주차장</h2>
              {route.parking ? (
                <>
                  <h3>{route.parking.name}</h3>
                  <p>{route.parking.address}</p>
                </>
              ) : (
                <p className="muted">선택한 주차장이 없습니다.</p>
              )}
              <h2>내 메모</h2>
              <p>{route.memo || "저장된 메모가 없습니다."}</p>
            </section>
          </>
        )}
      </main>
    </Shell>
  );
}
function CourseMap({ course }: { course: SavedCourse }) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState(
    MAP_KEY ? "지도를 불러오는 중입니다." : "지도를 사용할 수 없습니다.",
  );
  useEffect(() => {
    if (!ready || !window.kakao || !container.current) return;
    const api = window.kakao.maps,
      first = course.places[0];
    const map = new api.Map(container.current, {
      center: new api.LatLng(first.lat, first.lng),
      level: 5,
    });
    const markers = course.places.map(
      (place) =>
        new api.Marker({
          map,
          position: new api.LatLng(place.lat, place.lng),
          title: place.name,
        }),
    );
    const observer = new ResizeObserver(() => map.relayout());
    observer.observe(container.current);
    return () => {
      markers.forEach((marker) => marker.setMap(null));
      observer.disconnect();
    };
  }, [course, ready]);
  return (
    <div className="route-kakao-shell">
      {MAP_KEY && (
        <Script
          id="kakao-map-sdk"
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${MAP_KEY}&autoload=false&libraries=services`}
          onReady={() =>
            window.kakao?.maps.load(() => {
              setReady(true);
              setStatus("");
            })
          }
          onError={() => setStatus("지도를 불러오지 못했습니다.")}
        />
      )}
      <div
        ref={container}
        className="route-kakao-map"
        aria-label="저장한 장소 지도"
      />
      {!ready && <div className="map-fallback">{status}</div>}
    </div>
  );
}
