"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseBrowserEnv } from "@/lib/env";

type TourItem = {
  address: string;
  contentTypeId: string;
  id: string;
  image: string;
  mapX: string;
  mapY: string;
  sourceLabel?: string;
  tel: string;
  title: string;
};

type Report = {
  content: string;
  created_at?: string;
  id?: string;
  status?: string;
};

const parkingLots = [
  { id: "p1", name: "수원화성 제1주차장", distance: "50m · 도보 1분", remain: 45, status: "여유", badge: "장애인 구역", tone: "free" },
  { id: "p2", name: "행궁 광장 주차장", distance: "280m · 도보 4분", remain: 8, status: "혼잡", badge: "우회 추천", tone: "busy" },
  { id: "p3", name: "장안문 공영주차장", distance: "450m · 도보 6분", remain: 0, status: "만차", badge: "인근 대체 안내", tone: "full" },
];

const facilities = [
  { title: "경사로 진입점", desc: "행궁광장 서측 진입로", tag: "사진 확인됨" },
  { title: "장애인 화장실", desc: "화성행궁 안내소 옆", tag: "운영 중" },
  { title: "수유실", desc: "관광안내소 내부", tag: "09:00-18:00" },
  { title: "계단 회피 구간", desc: "장안문 남측 우회로", tag: "주의" },
];

function statusClass(tone: string) {
  if (tone === "free") return "ok";
  if (tone === "busy") return "warn";
  return "danger";
}

export function HomeApp() {
  const supabase = useMemo(() => createClient(), []);
  const env = getSupabaseBrowserEnv();
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState("휠체어");
  const [keyword, setKeyword] = useState("수원");
  const [places, setPlaces] = useState<TourItem[]>([]);
  const [reports, setReports] = useState<Report[]>([
    { content: "행궁광장 북측 보행로 통행 가능" },
    { content: "장안문 남측 경사 구간 보조 필요" },
  ]);
  const [reportText, setReportText] = useState("");
  const [status, setStatus] = useState("현재 위치: 수원화성 팔달구 일대 | API 연결 확인 전");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    void loadApi("수원");
    void loadReports();
  }, []);

  async function loadReports() {
    if (!supabase) return;
    const { data } = await supabase
      .from("reports")
      .select("id, content, status, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(6);
    if (data?.length) setReports(data);
  }

  async function loadApi(nextKeyword = keyword) {
    setStatus(`검색어: ${nextKeyword} | 한국관광공사 API 조회 중`);
    const [tourResponse, withResponse] = await Promise.all([
      fetch(`/api/tour/search?keyword=${encodeURIComponent(nextKeyword)}`),
      fetch(`/api/tour/with-search?keyword=${encodeURIComponent(nextKeyword)}`),
    ]);
    const tourData = await tourResponse.json();
    const withData = await withResponse.json();
    const tourItems = ((tourData.items || []) as TourItem[]).map((item) => ({ ...item, sourceLabel: "TourAPI" }));
    const withItems = ((withData.items || []) as TourItem[]).map((item) => ({ ...item, sourceLabel: "무장애 API" }));
    const merged = [...tourItems.slice(0, 4), ...withItems.slice(0, 2)];
    setPlaces(merged);
    setStatus(`검색어: ${nextKeyword} | 한국관광공사 API ${tourItems.length + withItems.length}건 확인`);
  }

  async function loadLocation() {
    const response = await fetch("/api/tour/location?mapX=127.014028&mapY=37.281889&radius=2000");
    const data = await response.json();
    setPlaces(((data.items || []) as TourItem[]).map((item) => ({ ...item, sourceLabel: "위치기반 API" })));
    setStatus(`수원화성 반경 2km | 위치기반 관광정보 ${(data.items || []).length}건 확인`);
    document.querySelector("#api")?.scrollIntoView({ behavior: "smooth" });
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = reportText.trim();
    if (!content) return;

    if (!supabase) {
      setReports([{ content }, ...reports].slice(0, 6));
      setReportText("");
      setMessage("Supabase 연결 전이라 화면에만 제보를 추가했습니다.");
      return;
    }

    if (!user) {
      setMessage("제보 등록은 로그인 후 이용할 수 있습니다.");
      return;
    }

    const { error } = await supabase.from("reports").insert({ content, user_id: user.id });
    if (error) {
      setMessage(error.message);
      return;
    }

    setReportText("");
    setMessage("제보가 등록되었습니다. 관리자가 승인하면 목록에 표시됩니다.");
    await loadReports();
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setUser(null);
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadApi(keyword || "수원");
    document.querySelector("#api")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      <nav className="navbar">
        <Link href="/" className="brand">수원 든든패스</Link>
        <div className="nav-links">
          <a href="#home">홈</a>
          <a href="#parking">주차장</a>
          <a href="#route">경로 안내</a>
          <a href="#api">관광지</a>
        </div>
        <div className="nav-actions">
          {user ? (
            <button className="nav-btn" onClick={signOut}>로그아웃</button>
          ) : (
            <>
              <Link className="nav-btn" href="/login">로그인</Link>
              <Link className="nav-btn primary" href="/signup">회원가입</Link>
            </>
          )}
        </div>
      </nav>

      {!env.configured && (
        <div className="notice">
          Supabase 환경변수가 아직 없습니다. 회원가입/로그인은 Supabase 프로젝트 URL과 publishable 또는 anon key를 Vercel에 넣으면 실제로 작동합니다.
        </div>
      )}

      <header id="home" className="hero">
        <div>
          <p className="eyebrow">수원화성 교통약자 관광 웹서비스</p>
          <h1>수원<br />든든패스</h1>
          <p className="lead">주차장 선택부터 무장애 경로, 현장 시설 가이드, 관광정보 검색까지 한 번에 확인하는 수원화성 맞춤형 관광 웹사이트입니다.</p>
          <form className="hero-search" onSubmit={search}>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} aria-label="검색어" />
            <button type="submit">검색</button>
          </form>
          <div className="hero-actions">
            <button className="primary-action" onClick={() => document.querySelector("#route")?.scrollIntoView({ behavior: "smooth" })}>경로 추천 시작</button>
            <button className="secondary-action" onClick={() => setMessage("즐겨찾기한 관광지를 기준으로 코스를 만들 수 있습니다.")}>나만의 코스 만들기</button>
          </div>
          <div className="user-panel">
            <strong>나의 이동 유형을 선택해주세요.</strong>
            <div className="user-types">
              {["휠체어", "유모차", "시각장애", "고령자"].map((type) => (
                <button key={type} className={`user-type ${type === userType ? "is-active" : ""}`} onClick={() => setUserType(type)}>
                  <span>{type.slice(0, 1)}</span><span>{type}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="map-preview">
          <div className="pin gate">장안문</div>
          <div className="pin palace">화성행궁</div>
          <div className="pin square">행궁광장</div>
          <div className="pin parking">P</div>
        </div>
      </header>

      <section id="parking">
        <div className="section-header">
          <div><p className="eyebrow">주차장 찾기</p><h2>주변 주차장 현황을 한눈에 확인하세요</h2></div>
        </div>
        <div className="cards">
          {parkingLots.map((lot) => (
            <article className="card parking-card" key={lot.id}>
              <div className={`parking-top ${lot.tone}`}>잔여 {lot.remain}면</div>
              <div className="parking-body">
                <span className="badge">주차장</span>
                <h3>{lot.name}</h3>
                <p className="muted">{lot.distance}</p>
                <div className="badge-row">
                  <span className={`badge ${statusClass(lot.tone)}`}>{lot.status}</span>
                  <span className="badge">{lot.badge}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="route" className="split-app">
        <div className="live-map">
          <div className="castle-zone">수원화성 중심</div>
          <div className="route-line" />
          <button className="marker p1">P1<small>잔여 45</small></button>
          <button className="marker p2">P2<small>잔여 8</small></button>
          <button className="marker p3">P3<small>잔여 0</small></button>
          <button className="marker p4">P4<small>대체</small></button>
        </div>
        <aside className="side-panel">
          <h2>주변 주차장</h2>
          <p className="muted">{userType} 기준으로 경로를 추천합니다.</p>
          <div className="side-list">
            {parkingLots.map((lot) => (
              <article className="side-item" key={lot.id}>
                <div className="round-icon">P</div>
                <div><strong>{lot.name}</strong><p className="muted">{lot.distance}</p></div>
                <button className="small-btn primary" disabled={lot.remain === 0}>선택</button>
              </article>
            ))}
          </div>
          <button className="primary-action" style={{ marginTop: 16 }} onClick={loadLocation}>내 위치 기준 관광정보</button>
        </aside>
      </section>
      <div className="statusbar">{status}</div>

      <section id="api">
        <div className="section-header">
          <div><p className="eyebrow">Korea TourAPI proxy</p><h2>수원 유명 관광지로의 무장애 경로 검색</h2></div>
          <form className="api-search" onSubmit={search}>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} aria-label="관광 API 검색어" />
            <button type="submit">검색</button>
          </form>
        </div>
        <div className="cards">
          {places.map((place) => (
            <article className="card" key={`${place.sourceLabel}-${place.id}`}>
              <div className="image-box">{place.image ? <img src={place.image} alt={`${place.title} 이미지`} /> : "이미지 없음"}</div>
              <span className="badge soft">{place.sourceLabel}</span>
              <h3>{place.title}</h3>
              <p className="muted">{place.address}</p>
              <div className="badge-row"><span className="badge soft">관광지</span><span className="badge soft">무장애 정보 매칭</span></div>
            </article>
          ))}
        </div>
      </section>

      <section id="facility">
        <div className="section-header"><div><p className="eyebrow">Field guide</p><h2>방문 전 확인하는 현장 시설 가이드</h2></div></div>
        <div className="facility-grid">
          {facilities.map((item) => (
            <article className="card" key={item.title}><h3>{item.title}</h3><p className="muted">{item.desc}</p><span className="badge soft">{item.tag}</span></article>
          ))}
        </div>
      </section>

      <section id="report">
        <div className="report-grid">
          <div>
            <h2>시설 상태 실시간 제보</h2>
            <p className="muted">공사, 파손, 임시 폐쇄 등 현장 변경 사항을 사용자가 직접 제보하는 채널입니다.</p>
            <form className="report-form" onSubmit={submitReport}>
              <input value={reportText} onChange={(event) => setReportText(event.target.value)} placeholder="예: 행궁광장 동측 보도 공사 중" />
              <button className="form-submit" type="submit">제보 등록</button>
            </form>
            {message && <p className="notice">{message}</p>}
          </div>
          <div className="card">
            <h3>최근 제보</h3>
            <ul className="report-list">{reports.map((report, index) => <li key={report.id || index}>{report.content}</li>)}</ul>
          </div>
        </div>
      </section>

      <div className="bottom-nav">
        <a href="#home">홈</a><a href="#parking">주차장</a><a href="#route">경로 안내</a><a href="#api">관광지</a><a href="#report">제보하기</a>
      </div>
      <footer><strong>수원 든든패스 | 수원시 관광 통합 정보 플랫폼</strong><span>© 2026 수원 든든패스</span></footer>
    </>
  );
}
