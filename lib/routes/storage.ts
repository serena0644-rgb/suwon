/**
 * 저장된 경로 데이터와 localStorage 접근을 한 곳에 모읍니다.
 * 홈 화면의 경로 만들기와 마이페이지가 같은 저장소를 공유하기 위해 컴포넌트에서 분리했습니다.
 */
import type { WalkOption } from "@/lib/routing/types";

export type Waypoint = {
  id: number;
  name: string;
  role: string;
  meta: string;
  tags: string[];
  next: string;
  lat: number;
  lng: number;
};

export type SavedRoute = {
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
  /** 이 경로를 어떤 보행 옵션으로 탐색했는지. 없으면 계단 제외 기준으로 다시 탐색합니다. */
  walkOption?: WalkOption;
};

export const STORAGE_KEY = "suwon-ddp-routes";
export const GUIDE_INTENT_KEY = "suwon-ddp-guide-intent";

export const defaultRoutes: SavedRoute[] = [
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
      { id: 1, name: "화성행궁", role: "출발", meta: "09:30 출발 예정 · 매표소 앞 집결", tags: ["경사로 진입", "장애인 화장실", "휠체어 대여"], next: "다음 구간 650m · 14분", lat: 37.281889, lng: 127.014028 },
      { id: 2, name: "행궁광장", role: "경유", meta: "휴식 10분 · 광장 그늘 쉼터", tags: ["평지", "그늘 쉼터", "수유실"], next: "다음 구간 700m · 15분", lat: 37.282512, lng: 127.013211 },
      { id: 3, name: "공방거리", role: "경유", meta: "체험 30분 · 보도 폭 1.5m 이상", tags: ["계단 우회로", "턱 없음"], next: "다음 구간 1.1km · 23분", lat: 37.283522, lng: 127.015403 },
      { id: 4, name: "행궁동 벽화마을", role: "도착", meta: "11:20 도착 예정 · 일부 구간 경사 8%", tags: ["사진 확인됨", "주의 구간"], next: "도착", lat: 37.286218, lng: 127.014912 },
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
      { id: 1, name: "장안문", role: "출발", meta: "10:00 출발 예정 · 북측 안내판 앞", tags: ["평지", "벤치"], next: "다음 구간 500m · 11분", lat: 37.287786, lng: 127.01431 },
      { id: 2, name: "화홍문", role: "경유", meta: "휴식 15분 · 수변 쉼터", tags: ["그늘 쉼터", "사진 명소"], next: "다음 구간 800m · 18분", lat: 37.287033, lng: 127.017846 },
      { id: 3, name: "장안공원", role: "도착", meta: "10:45 도착 예정", tags: ["화장실", "대중교통 연계"], next: "도착", lat: 37.28931, lng: 127.012981 },
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
      { id: 1, name: "행궁광장", role: "출발", meta: "13:00 출발 예정 · 서측 진입부", tags: ["수유실", "평지"], next: "다음 구간 350m · 8분", lat: 37.282512, lng: 127.013211 },
      { id: 2, name: "관광안내소", role: "경유", meta: "기저귀 교환대 확인", tags: ["수유실", "화장실"], next: "다음 구간 520m · 13분", lat: 37.281643, lng: 127.014001 },
      { id: 3, name: "화성행궁", role: "도착", meta: "13:30 도착 예정", tags: ["경사로", "그늘"], next: "도착", lat: 37.281889, lng: 127.014028 },
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
      { id: 1, name: "팔달문", role: "출발", meta: "14:00 출발 예정 · 동측 횡단보도", tags: ["음향신호기", "횡단 주의"], next: "다음 구간 420m · 10분", lat: 37.277764, lng: 127.017173 },
      { id: 2, name: "시장 입구", role: "경유", meta: "혼잡 구간 · 동행 권장", tags: ["유도블록 단절", "주의"], next: "다음 구간 600m · 16분", lat: 37.278646, lng: 127.016295 },
      { id: 3, name: "남문로", role: "경유", meta: "보행 폭 1.4m", tags: ["평지", "차도 인접"], next: "다음 구간 980m · 21분", lat: 37.280526, lng: 127.016743 },
      { id: 4, name: "행궁광장", role: "도착", meta: "14:50 도착 예정", tags: ["넓은 광장", "휴식"], next: "도착", lat: 37.282512, lng: 127.013211 },
    ],
  },
];

export function readRoutes(): SavedRoute[] {
  if (typeof window === "undefined") return defaultRoutes;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // 프라이빗 모드 등에서 localStorage 가 막혀 있으면 기본 목록을 씁니다.
    return defaultRoutes;
  }
  if (!raw) return defaultRoutes;
  try {
    const parsed = JSON.parse(raw) as SavedRoute[];
    return parsed.length ? parsed : defaultRoutes;
  } catch {
    return defaultRoutes;
  }
}

/*
 * 아래는 useSyncExternalStore 용 스토어입니다.
 * 저장 목록은 여러 화면(마이페이지 목록/상세, 홈의 경로 만들기)이 함께 보므로,
 * 각 화면이 mount 시점에 따로 읽는 대신 한 스토어를 구독하게 해서 저장 즉시 모두 갱신되도록 했습니다.
 */

const listeners = new Set<() => void>();
let snapshot: SavedRoute[] | null = null;

function emit() {
  snapshot = null;
  listeners.forEach((listener) => listener());
}

export function writeRoutes(routes: SavedRoute[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  } catch {
    // 저장에 실패해도 화면 상태는 최신으로 맞춰 줍니다.
  }
  snapshot = routes;
  listeners.forEach((listener) => listener());
}

export function subscribeRoutes(listener: () => void) {
  listeners.add(listener);
  // 다른 탭에서 저장한 변경도 반영합니다.
  window.addEventListener("storage", emit);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", emit);
  };
}

/** useSyncExternalStore 규약상 값이 바뀌지 않으면 같은 참조를 돌려줘야 합니다. */
export function getRoutesSnapshot(): SavedRoute[] {
  if (!snapshot) snapshot = readRoutes();
  return snapshot;
}

export function getRoutesServerSnapshot(): SavedRoute[] {
  return defaultRoutes;
}

export function takeGuideIntent(routeId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const intent = window.sessionStorage.getItem(GUIDE_INTENT_KEY);
    if (intent !== routeId) return false;
    window.sessionStorage.removeItem(GUIDE_INTENT_KEY);
    return true;
  } catch {
    return false;
  }
}

export function setGuideIntent(routeId: string) {
  try {
    window.sessionStorage.setItem(GUIDE_INTENT_KEY, routeId);
  } catch {
    // sessionStorage 가 막혀 있으면 자동 시작만 생략됩니다.
  }
}

export function makeGeneratedRoute(index: number): SavedRoute {
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
