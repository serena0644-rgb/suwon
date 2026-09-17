"use client";
import Link from "next/link";
import Image from "next/image";
import { KAKAO_MAP_KEY } from "@/lib/kakao";
import Script from "next/script";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useSaved } from "@/lib/use-saved";
import type { TourItem } from "@/lib/tour/api";
import {
  saveParking,
  saveCourse,
  type Place,
  type SavedCourse,
} from "@/lib/selection";
type Position = {
  lat: number;
  lng: number;
};
type MapInstance = {
  setCenter: (position: unknown) => void;
  relayout: () => void;
};
type Marker = {
  setMap: (map: MapInstance | null) => void;
};
type KakaoPlace = {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  phone: string;
  place_url: string;
  distance: string;
};
type SearchOptions = {
  location?: unknown;
  radius?: number;
  sort?: string;
  category_group_code?: string;
};
declare global {
  interface Window {
    kakao?: {
      maps: {
        LatLng: new (lat: number, lng: number) => unknown;
        Map: new (
          container: HTMLElement,
          options: {
            center: unknown;
            level: number;
          },
        ) => MapInstance;
        Marker: new (options: {
          map: MapInstance;
          position: unknown;
          title?: string;
        }) => Marker;
        event: {
          addListener: (
            target: unknown,
            type: string,
            handler: () => void,
          ) => void;
        };
        load: (callback: () => void) => void;
        services: {
          Places: new () => {
            keywordSearch: (
              keyword: string,
              callback: (items: KakaoPlace[], status: string) => void,
              options?: SearchOptions,
            ) => void;
            categorySearch: (
              category: string,
              callback: (items: KakaoPlace[], status: string) => void,
              options: SearchOptions,
            ) => void;
          };
          Status: {
            OK: string;
            ZERO_RESULT: string;
          };
          SortBy: {
            DISTANCE: string;
          };
        };
      };
    };
  }
}
const MAP_KEY = KAKAO_MAP_KEY;
const LOGO =
  "https://www.figma.com/api/mcp/asset/e11201e1-6df0-4ede-8b0f-6ec2ee5c9c44.png";
// Initial viewport only, never used as the user's position or a selected destination.
const INITIAL_VIEW = { lat: 37.281889, lng: 127.014028 };
const facilityFields = [
  ["parking", "장애인 주차"],
  ["route", "접근 경로"],
  ["restroom", "장애인 화장실"],
  ["wheelchair", "휠체어"],
  ["elevator", "엘리베이터"],
  ["exit", "출입구"],
  ["publictransport", "대중교통"],
  ["guidehuman", "안내 지원"],
  ["helpdog", "보조견"],
  ["stroller", "유모차"],
];
function kakaoPlace(item: KakaoPlace): Place | null {
  const lat = Number(item.y),
    lng = Number(item.x);
  if (
    !item.id ||
    !item.place_name ||
    !item.y ||
    !item.x ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  return {
    id: item.id,
    name: item.place_name,
    address: item.road_address_name || item.address_name || "",
    lat,
    lng,
    phone: item.phone || "",
    url: item.place_url || "",
    source: "kakao",
  };
}
function tourPlace(item: TourItem): Place | null {
  const lat = Number(item.mapY),
    lng = Number(item.mapX);
  if (
    !item.id ||
    !item.mapY ||
    !item.mapX ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  return {
    id: item.id,
    contentId: item.id,
    name: item.title,
    address: item.address,
    lat,
    lng,
    phone: item.tel,
    image: item.image,
    source: "tourapi",
  };
}
function directions(place: Place) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lng}`;
}
export function HomeApp() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [keyword, setKeyword] = useState("");
  const [parkingKeyword, setParkingKeyword] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [parkingLots, setParkingLots] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const saved = useSaved();
  const [parkingSelection, setParking] = useState<Place | null | undefined>(
    undefined,
  );
  const parking =
    parkingSelection === undefined ? saved.parking : parkingSelection;
  const [courseSelection, setCourse] = useState<SavedCourse | null>(null);
  const course = courseSelection || saved.courses[0] || null;
  const [stops, setStops] = useState<Place[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [locationStatus, setLocationStatus] = useState(
    "현재 위치를 아직 확인하지 않았습니다.",
  );
  const [mapStatus, setMapStatus] = useState(
    MAP_KEY ? "지도를 불러오는 중입니다." : "지도를 사용할 수 없습니다.",
  );
  const [ready, setReady] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  const [parkingStatus, setParkingStatus] = useState(
    "현재 위치를 확인하거나 주차장을 검색해 주세요.",
  );
  const [detail, setDetail] = useState<Record<string, string> | null>(null);
  const [detailStatus, setDetailStatus] = useState("");
  const [reports, setReports] = useState<
    {
      id?: string;
      content: string;
    }[]
  >([]);
  const [reportText, setReportText] = useState("");
  const [message, setMessage] = useState("");
  const routeContainer = useRef<HTMLDivElement>(null);
  const parkingContainer = useRef<HTMLDivElement>(null);
  const maps = useRef<MapInstance[]>([]);
  const searchSequence = useRef(0);
  const parkingSequence = useRef(0);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );
    supabase
      .from("reports")
      .select("id, content")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setReports(data || []));
    return () => data.subscription.unsubscribe();
  }, [supabase]);
  useEffect(() => {
    if (
      !ready ||
      !window.kakao ||
      !routeContainer.current ||
      !parkingContainer.current
    )
      return;
    const api = window.kakao.maps;
    maps.current = [parkingContainer.current, routeContainer.current].map(
      (container) =>
        new api.Map(container, {
          center: new api.LatLng(INITIAL_VIEW.lat, INITIAL_VIEW.lng),
          level: 4,
        }),
    );
    const observer = new ResizeObserver(() =>
      maps.current.forEach((map) => map.relayout()),
    );
    observer.observe(routeContainer.current);
    observer.observe(parkingContainer.current);
    return () => {
      observer.disconnect();
      maps.current = [];
    };
  }, [ready]);
  useEffect(() => {
    if (!ready || !window.kakao) return;
    const api = window.kakao.maps;
    const markers: Marker[] = [];
    maps.current.forEach((map, index) => {
      const items = index === 0 ? parkingLots : results;
      items.forEach((place) => {
        const marker = new api.Marker({
          map,
          position: new api.LatLng(place.lat, place.lng),
          title: place.name,
        });
        api.event.addListener(marker, "click", () =>
          index === 0 ? selectParking(place) : selectPlace(place),
        );
        markers.push(marker);
      });
      const target = index === 0 ? parking : selected;
      if (position)
        markers.push(
          new api.Marker({
            map,
            position: new api.LatLng(position.lat, position.lng),
            title: "현재 위치",
          }),
        );
      if (target) {
        const point = new api.LatLng(target.lat, target.lng);
        markers.push(
          new api.Marker({
            map,
            position: point,
            title: `선택: ${target.name}`,
          }),
        );
        map.setCenter(point);
      } else if (position)
        map.setCenter(new api.LatLng(position.lat, position.lng));
      else if (items[0])
        map.setCenter(new api.LatLng(items[0].lat, items[0].lng));
    });
    return () => markers.forEach((marker) => marker.setMap(null));
  }, [ready, position, parkingLots, results, parking, selected]);
  useEffect(() => {
    if (!selected?.contentId) return;
    const controller = new AbortController();
    fetch(
      `/api/tour/detail?contentId=${encodeURIComponent(selected.contentId)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.message);
        return data;
      })
      .then((data) => {
        setDetail(data.detail);
        setDetailStatus(
          data.accessibilityAvailable
            ? ""
            : "무장애 시설정보를 불러오지 못했습니다.",
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setDetailStatus(error.message || "시설정보 조회 실패");
      });
    return () => controller.abort();
  }, [selected]);
  function selectParking(place: Place) {
    setParking(place);
  }
  function selectPlace(place: Place | null) {
    setSelected(place);
    setDetail(null);
    setDetailStatus(place?.contentId ? "시설정보를 불러오는 중입니다." : "");
  }
  function requestLocation() {
    setPosition(null);
    if (!navigator.geolocation) {
      setLocationStatus("이 브라우저에서는 위치정보를 사용할 수 없습니다.");
      return;
    }
    setLocationStatus("현재 위치를 확인하는 중입니다.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { lat: coords.latitude, lng: coords.longitude };
        setPosition(next);
        setLocationStatus(
          `현재 위치: ${next.lat.toFixed(5)}, ${next.lng.toFixed(5)} · 정확도 약 ${Math.round(coords.accuracy)}m`,
        );
        if (ready) searchParking(next);
      },
      (error) =>
        setLocationStatus(
          error.code === 1
            ? "위치 권한이 거부되었습니다. 주차장 이름으로 검색할 수 있습니다."
            : "현재 위치를 확인할 수 없습니다. 다시 시도해 주세요.",
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }
  function searchParking(current = position) {
    if (!ready || !window.kakao) {
      setParkingStatus("지도 연결을 확인한 뒤 다시 검색해 주세요.");
      return;
    }
    const api = window.kakao.maps;
    const service = new api.services.Places();
    const sequence = ++parkingSequence.current;
    setParkingLots([]);
    setParkingStatus("주차장을 검색하는 중입니다.");
    const callback = (items: KakaoPlace[], status: string) => {
      if (sequence !== parkingSequence.current) return;
      const next =
        status === api.services.Status.OK
          ? items.map(kakaoPlace).filter((item): item is Place => Boolean(item))
          : [];
      setParkingLots(next);
      setParkingStatus(
        status === api.services.Status.OK
          ? `주차장 ${next.length}곳`
          : status === api.services.Status.ZERO_RESULT
            ? "검색 결과가 없습니다."
            : "주차장 검색에 실패했습니다.",
      );
    };
    if (parkingKeyword.trim())
      service.keywordSearch(parkingKeyword.trim(), callback, {
        ...(current
          ? { location: new api.LatLng(current.lat, current.lng), radius: 2000 }
          : {}),
        category_group_code: "PK6",
      } as SearchOptions);
    else if (current)
      service.categorySearch("PK6", callback, {
        location: new api.LatLng(current.lat, current.lng),
        radius: 2000,
        sort: api.services.SortBy.DISTANCE,
      });
    else
      setParkingStatus("현재 위치를 확인하거나 주차장 이름을 입력해 주세요.");
  }
  async function search(event: FormEvent) {
    event.preventDefault();
    const query = keyword.trim();
    if (!query) return;
    const sequence = ++searchSequence.current;
    setResults([]);
    selectPlace(null);
    setSearchStatus("장소를 검색하는 중입니다.");
    const requests: Promise<Place[]>[] = [
      ...["search", "with-search"].map(async (endpoint) => {
        const response = await fetch(
          `/api/tour/${endpoint}?keyword=${encodeURIComponent(query)}`,
        );
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.message);
        return (data.items as TourItem[])
          .map(tourPlace)
          .filter((item): item is Place => Boolean(item));
      }),
    ];
    if (ready && window.kakao) {
      const api = window.kakao.maps;
      requests.push(
        new Promise((resolve, reject) =>
          new api.services.Places().keywordSearch(query, (items, status) => {
            if (status === api.services.Status.OK)
              resolve(
                items
                  .map(kakaoPlace)
                  .filter((item): item is Place => Boolean(item)),
              );
            else if (status === api.services.Status.ZERO_RESULT) resolve([]);
            else reject(new Error("장소 검색 실패"));
          }),
        ),
      );
    }
    const responses = await Promise.allSettled(requests);
    if (sequence !== searchSequence.current) return;
    const unique = new Map<string, Place>();
    responses.forEach((response) => {
      if (response.status === "fulfilled")
        response.value.forEach((place) =>
          unique.set(`${place.source}-${place.id}`, place),
        );
    });
    setResults([...unique.values()]);
    const failed = responses.some((response) => response.status === "rejected");
    setSearchStatus(
      unique.size
        ? `${unique.size}건${failed ? " · 일부 관광정보를 불러오지 못했습니다." : ""}`
        : failed
          ? "장소 정보를 불러오지 못했습니다. 다시 시도해 주세요."
          : "검색 결과가 없습니다.",
    );
  }
  async function loadNearby() {
    if (!position) {
      requestLocation();
      return;
    }
    const sequence = ++searchSequence.current;
    selectPlace(null);
    setResults([]);
    setSearchStatus("현재 위치 주변 관광정보를 불러오는 중입니다.");
    try {
      const response = await fetch(
        `/api/tour/location?mapX=${position.lng}&mapY=${position.lat}&radius=2000`,
      );
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message);
      if (sequence !== searchSequence.current) return;
      const next = (data.items as TourItem[])
        .map(tourPlace)
        .filter((place): place is Place => Boolean(place));
      setResults(next);
      setSearchStatus(
        next.length
          ? `현재 위치 반경 2km · ${next.length}건`
          : "주변 관광정보가 없습니다.",
      );
    } catch {
      if (sequence === searchSequence.current)
        setSearchStatus("주변 관광정보를 불러오지 못했습니다.");
    }
  }
  function addStop() {
    if (
      selected &&
      !stops.some(
        (place) => place.id === selected.id && place.source === selected.source,
      )
    )
      setStops([...stops, selected]);
  }
  function createCustomCourse() {
    if (!stops.length) {
      document.getElementById("route")?.scrollIntoView({ behavior: "smooth" });
      setMessage("코스에 담을 장소를 선택해 주세요.");
      return;
    }
    const saved = saveCourse(stops, parking);
    if (!saved) {
      setMessage("코스를 저장하지 못했습니다.");
      return;
    }
    setCourse(saved);
    setMessage("선택한 장소를 방문 목록으로 저장했습니다.");
  }
  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (!reportText.trim()) return;
    if (!supabase || !user) {
      setMessage("제보 등록은 로그인 후 이용할 수 있습니다.");
      return;
    }
    const { error } = await supabase
      .from("reports")
      .insert({ content: reportText.trim(), user_id: user.id });
    setMessage(
      error
        ? "제보를 등록하지 못했습니다."
        : "제보가 등록되었습니다. 승인 후 표시됩니다.",
    );
    if (!error) setReportText("");
  }
  function placePanel(place: Place, isParking = false) {
    return (
      <div className="selected-route">
        <strong>{place.name}</strong>
        {place.address && <p>{place.address}</p>}
        {place.phone && <p>{place.phone}</p>}
        <p className="muted">
          {place.source === "kakao"
            ? "카카오 장소정보"
            : "한국관광공사 관광정보"}
        </p>
        <div className="place-actions">
          <a
            className="small-btn primary"
            href={directions(place)}
            target="_blank"
            rel="noopener noreferrer"
          >
            카카오맵 길안내
          </a>
          {isParking ? (
            <button
              className="small-btn"
              onClick={() =>
                setMessage(
                  saveParking(place)
                    ? "주차장을 저장했습니다."
                    : "주차장을 저장하지 못했습니다.",
                )
              }
            >
              주차장 저장
            </button>
          ) : (
            <button className="small-btn" onClick={addStop}>
              코스에 담기
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <>
      {MAP_KEY && (
        <Script
          id="kakao-map-sdk"
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${MAP_KEY}&autoload=false&libraries=services`}
          strategy="afterInteractive"
          onReady={() =>
            window.kakao?.maps.load(() => {
              setReady(true);
              setMapStatus("");
            })
          }
          onError={() => setMapStatus("지도를 불러오지 못했습니다.")}
        />
      )}
      <nav className="navbar">
        <Link href="/" className="brand">
          수원 든든패스
        </Link>
        <div className="nav-links">
          <a href="#home">홈</a>
          <a href="#parking">주차장</a>
          <a href="#route">경로 안내</a>
          <a href="#facility">현장 시설</a>
          <Link href="/mypage">마이페이지</Link>
        </div>
        <div className="nav-actions">
          {user ? (
            <>
              <Link className="nav-btn" href="/mypage">
                마이페이지
              </Link>
              <button
                className="nav-btn"
                onClick={() => supabase?.auth.signOut()}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link className="nav-btn" href="/login">
                로그인
              </Link>
              <Link className="nav-btn primary" href="/signup">
                회원가입
              </Link>
            </>
          )}
        </div>
      </nav>
      <header id="home" className="hero">
        <div className="brand-preview">
          <Image
            unoptimized
            priority
            width={891}
            height={1260}
            src={LOGO}
            alt="수원 든든패스 로고"
          />
        </div>
        <form
          className="hero-search"
          onSubmit={(event) => {
            void search(event);
            document
              .getElementById("route")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            aria-label="장소 검색"
            placeholder="장소를 검색하세요"
          />
          <button type="submit">검색</button>
        </form>
        <div className="hero-actions">
          <a className="primary-action" href="#route">
            경로 추천 시작
          </a>
          <button className="secondary-action" onClick={createCustomCourse}>
            나만의 코스 만들기
          </button>
        </div>
      </header>
      <section id="parking">
        <div className="section-header">
          <div>
            <p className="eyebrow">주차장 찾기</p>
            <h2>주변 주차장</h2>
          </div>
          <button className="small-btn primary" onClick={requestLocation}>
            현재 위치 확인
          </button>
        </div>
        <p role="status">{locationStatus}</p>
        <form
          className="api-search"
          onSubmit={(event) => {
            event.preventDefault();
            searchParking();
          }}
        >
          <input
            aria-label="주차장 검색"
            placeholder="주차장 이름 또는 지역"
            value={parkingKeyword}
            onChange={(event) => setParkingKeyword(event.target.value)}
          />
          <button type="submit">검색</button>
        </form>
        <p role="status">{parkingStatus}</p>
        <div className="parking-layout">
          <div className="live-map kakao-route-panel">
            <div
              ref={parkingContainer}
              className="kakao-map"
              aria-label="주차장 지도"
            />
            {!ready && <div className="map-fallback">{mapStatus}</div>}
          </div>
          <div className="side-panel">
            {parking && placePanel(parking, true)}
            <div className="search-results">
              {parkingLots.map((place) => (
                <button
                  className="place-result"
                  aria-pressed={parking?.id === place.id}
                  key={place.id}
                  onClick={() => selectParking(place)}
                >
                  <strong>{place.name}</strong>
                  <span>{place.address}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section
        id="route"
        className={
          selected || results.length || searchStatus
            ? "split-app"
            : "split-app map-only"
        }
      >
        <div className="live-map kakao-route-panel">
          <div
            ref={routeContainer}
            className="kakao-map"
            aria-label="장소 검색 지도"
          />
          {!ready && <div className="map-fallback">{mapStatus}</div>}
          <div className="map-search">
            <form className="api-search" onSubmit={search}>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                aria-label="지도 장소 검색"
                placeholder="장소를 검색하세요"
              />
              <button type="submit">검색</button>
            </form>
            <button className="small-btn" onClick={requestLocation}>
              현재 위치
            </button>
            <button className="small-btn" onClick={loadNearby}>
              주변 관광지
            </button>
          </div>
        </div>
        {(selected || results.length > 0 || searchStatus) && (
          <aside className="side-panel">
            <p role="status">{searchStatus}</p>
            <div className="search-results">
              {results.map((place) => (
                <button
                  className="place-result"
                  key={`${place.source}-${place.id}`}
                  aria-pressed={
                    selected?.id === place.id &&
                    selected?.source === place.source
                  }
                  onClick={() => selectPlace(place)}
                >
                  <strong>{place.name}</strong>
                  <span>{place.address}</span>
                  <span>
                    {place.source === "tourapi" ? "한국관광공사" : "카카오"}
                  </span>
                </button>
              ))}
            </div>
            {selected && (
              <>
                {placePanel(selected)}
                <button className="card-link" onClick={() => selectPlace(null)}>
                  선택 닫기
                </button>
              </>
            )}
          </aside>
        )}
      </section>
      <section id="api">
        <div className="section-header">
          <h2>선택한 장소</h2>
        </div>
        {selected ? (
          <>
            {selected.image && (
              <Image
                unoptimized
                width={560}
                height={400}
                className="selected-image"
                src={selected.image}
                alt={selected.name}
              />
            )}
            <h3>{selected.name}</h3>
            <p>{selected.address}</p>
            {detail?.overview && <p>{detail.overview}</p>}
          </>
        ) : (
          <p className="muted">선택한 장소가 없습니다.</p>
        )}
      </section>
      <section id="facility">
        <div className="section-header">
          <h2>방문 전 확인하는 현장 시설 가이드</h2>
        </div>
        {!selected ? (
          <p className="muted">선택한 관광지가 없습니다.</p>
        ) : (
          <>
            <h3>{selected.name}</h3>
            {!selected.contentId ? (
              <p className="muted">연결된 관광 시설정보가 없습니다.</p>
            ) : (
              <>
                <p role="status">{detailStatus}</p>
                {detail && (
                  <div className="facility-grid">
                    {facilityFields.map(([field, label]) => (
                      <article className="card" key={field}>
                        <h3>{label}</h3>
                        <p>{detail[field] || "정보 없음"}</p>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>
      <section id="mypage">
        <div className="section-header">
          <h2>나의 주차장과 추천 코스</h2>
          <Link className="small-btn primary" href="/mypage">
            마이페이지 열기
          </Link>
        </div>
        <div className="mypage-grid">
          <article className="card">
            <h3>나의 주차장</h3>
            {parking ? (
              placePanel(parking, true)
            ) : (
              <p className="muted">저장되거나 선택한 주차장이 없습니다.</p>
            )}
          </article>
          <article className="card">
            <h3>나만의 코스</h3>
            {stops.length ? (
              <ol className="course-list">
                {stops.map((place) => (
                  <li key={`${place.source}-${place.id}`}>
                    {place.name}
                    <button
                      className="card-link"
                      onClick={() =>
                        setStops(stops.filter((item) => item !== place))
                      }
                    >
                      제거
                    </button>
                  </li>
                ))}
              </ol>
            ) : course ? (
              <ol className="course-list">
                {course.places.map((place) => (
                  <li key={`${place.source}-${place.id}`}>{place.name}</li>
                ))}
              </ol>
            ) : (
              <p className="muted">저장된 코스가 없습니다.</p>
            )}
            <button className="small-btn" onClick={createCustomCourse}>
              코스 저장
            </button>
          </article>
          <article className="card">
            <h3>계정 상태</h3>
            <p>{user?.email || "비회원"}</p>
          </article>
        </div>
      </section>
      <section id="report">
        <div className="report-grid">
          <div>
            <h2>시설 상태 제보</h2>
            <form className="report-form" onSubmit={submitReport}>
              <input
                aria-label="시설 상태 제보"
                value={reportText}
                onChange={(event) => setReportText(event.target.value)}
                placeholder="현장에서 확인한 내용을 입력하세요"
              />
              <button className="form-submit" type="submit">
                제보 등록
              </button>
            </form>
          </div>
          <div className="card">
            <h3>최근 제보</h3>
            {reports.length ? (
              <ul className="report-list">
                {reports.map((report) => (
                  <li key={report.id}>{report.content}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">확인된 제보가 없습니다.</p>
            )}
          </div>
        </div>
      </section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="bottom-nav">
        <a href="#home">홈</a>
        <a href="#parking">주차장</a>
        <a href="#route">경로 안내</a>
        <a href="#facility">시설 안내</a>
        <a href="#report">제보하기</a>
        <Link href="/mypage">마이페이지</Link>
      </div>
      <footer>
        <strong>수원 든든패스 | 수원시 관광 통합 정보 플랫폼</strong>
        <span>© 2026 수원 든든패스</span>
      </footer>
    </>
  );
}
