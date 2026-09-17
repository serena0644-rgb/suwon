import type { KakaoMaps } from "./types";

const SCRIPT_ID = "kakao-map-sdk";

let loadPromise: Promise<KakaoMaps> | null = null;

/**
 * 카카오 지도 SDK 를 한 번만 로드합니다.
 * 기존에는 화면마다 next/script 로 같은 SDK 를 중복 로드하고 있었는데,
 * 지도를 쓰는 컴포넌트가 늘어나면서 로드 상태를 한 곳에서 관리하도록 바꿨습니다.
 */
export function loadKakaoMaps(appKey: string): Promise<KakaoMaps> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("카카오맵은 브라우저에서만 불러올 수 있습니다."));
  }

  if (!appKey) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_KAKAO_MAP_APP_KEY 환경변수가 없어 지도를 불러올 수 없습니다."),
    );
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise<KakaoMaps>((resolve, reject) => {
    const settle = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        reject(new Error("카카오맵 SDK 초기화에 실패했습니다."));
        return;
      }
      maps.load(() => resolve(maps));
    };

    if (window.kakao?.maps) {
      settle();
      return;
    }

    const fail = () => {
      loadPromise = null;
      reject(new Error("카카오맵 SDK를 불러오지 못했습니다. 앱키와 등록된 도메인을 확인해 주세요."));
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", settle, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.addEventListener("load", settle, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.appendChild(script);
  });

  return loadPromise;
}
