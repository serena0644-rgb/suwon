export function getSupabaseBrowserEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  return {
    configured: Boolean(url && key),
    key,
    url,
  };
}

/**
 * 카카오 지도 JS SDK 앱키. 클라이언트에서 SDK 를 직접 로드해야 하므로 NEXT_PUBLIC_ 로 노출됩니다.
 * (카카오 개발자 콘솔에서 허용 도메인을 등록해 사용 범위를 제한하세요.)
 */
export function getKakaoMapAppKey() {
  return KAKAO_MAP_KEY;
}
import { KAKAO_MAP_KEY } from "./kakao";
