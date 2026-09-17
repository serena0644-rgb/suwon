export const TOUR_BASE_URL = "https://apis.data.go.kr/B551011/KorService2";
export const WITH_BASE_URL = "https://apis.data.go.kr/B551011/KorWithService2";

export type TourItem = {
  address: string;
  contentTypeId: string;
  id: string;
  image: string;
  mapX: string;
  mapY: string;
  sample?: boolean;
  tel: string;
  title: string;
};

type TourApiRecord = Record<string, string | undefined>;

export function getItems(data: unknown): TourApiRecord[] {
  const item = (data as { response?: { body?: { items?: { item?: unknown } } } })?.response?.body?.items?.item;
  if (!item) return [];
  return (Array.isArray(item) ? item : [item]) as TourApiRecord[];
}

export function normalize(item: TourApiRecord): TourItem {
  return {
    id: item.contentid || "",
    title: item.title || "이름 없음",
    address: item.addr1 || item.addr2 || "주소 정보 없음",
    image: item.firstimage || item.firstimage2 || "",
    mapX: item.mapx || "",
    mapY: item.mapy || "",
    tel: item.tel || "",
    contentTypeId: item.contenttypeid || "",
  };
}

export function fallback(keyword = "수원"): TourItem[] {
  const items: TourItem[] = [
    {
      id: "sample-1",
      title: "화성행궁",
      address: "경기도 수원시 팔달구 정조로 825",
      image: "",
      mapX: "127.014028",
      mapY: "37.281889",
      tel: "",
      contentTypeId: "12",
      sample: true,
    },
    {
      id: "sample-2",
      title: "행궁광장",
      address: "경기도 수원시 팔달구 행궁동",
      image: "",
      mapX: "127.013420",
      mapY: "37.282550",
      tel: "",
      contentTypeId: "12",
      sample: true,
    },
    {
      id: "sample-3",
      title: "장안문",
      address: "경기도 수원시 팔달구 장안동",
      image: "",
      mapX: "127.014829",
      mapY: "37.288970",
      tel: "",
      contentTypeId: "12",
      sample: true,
    },
  ];

  if (!keyword || keyword.includes("수원") || keyword.includes("화성")) return items;
  return items.filter((item) => item.title.includes(keyword));
}

export function buildUrl(baseUrl: string, endpoint: string, params: Record<string, string>) {
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

  return `${baseUrl}/${endpoint}?serviceKey=${key}&${query.toString()}`;
}

export async function requestApi(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.json();
}

export function stripHtml(value: string) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
