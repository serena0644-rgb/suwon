export const TOUR_BASE_URL = "https://apis.data.go.kr/B551011/KorService2";
export const WITH_BASE_URL = "https://apis.data.go.kr/B551011/KorWithService2";
export type TourItem = {
  address: string;
  contentTypeId: string;
  id: string;
  image: string;
  mapX: string;
  mapY: string;
  tel: string;
  title: string;
};
type ApiRecord = Record<string, string>;
export function getItems(data: {
  response?: {
    body?: {
      items?: {
        item?: ApiRecord | ApiRecord[];
      };
    };
  };
}): ApiRecord[] {
  const item = data?.response?.body?.items?.item;
  return item ? (Array.isArray(item) ? item : [item]) : [];
}
export function normalize(item: ApiRecord): TourItem {
  return {
    id: item.contentid || "",
    title: item.title || "",
    address: [item.addr1, item.addr2].filter(Boolean).join(" "),
    image: item.firstimage || item.firstimage2 || "",
    mapX: item.mapx || "",
    mapY: item.mapy || "",
    tel: item.tel || "",
    contentTypeId: item.contenttypeid || "",
  };
}
export function buildUrl(
  baseUrl: string,
  endpoint: string,
  params: Record<string, string>,
) {
  const key = process.env.TOUR_API_SERVICE_KEY;
  if (!key) return null;
  const query = new URLSearchParams({
    numOfRows: "12",
    pageNo: "1",
    MobileOS: "ETC",
    MobileApp: "SuwonDendeunPass",
    _type: "json",
    ...params,
  });
  return `${baseUrl}/${endpoint}?serviceKey=${encodeURIComponent(decodeURIComponent(key))}&${query}`;
}
export async function requestApi(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`관광정보 조회 실패 (${response.status})`);
  const data = await response.json();
  const header = data?.response?.header;
  if (!header || !["0000", "00"].includes(String(header.resultCode)))
    throw new Error("관광정보 제공기관에서 정상 응답을 받지 못했습니다.");
  return data;
}
export function stripHtml(value: string) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
