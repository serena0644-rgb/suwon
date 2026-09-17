import { NextResponse } from "next/server";
import {
  TOUR_BASE_URL,
  buildUrl,
  getItems,
  normalize,
  requestApi,
} from "@/lib/tour/api";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const keyword = params.get("keyword")?.trim();
  if (!keyword)
    return NextResponse.json(
      { ok: false, items: [], message: "검색어가 필요합니다." },
      { status: 400 },
    );
  const url = buildUrl(TOUR_BASE_URL, "searchKeyword2", { keyword });
  if (!url)
    return NextResponse.json(
      { ok: false, items: [], message: "관광정보 연결이 준비되지 않았습니다." },
      { status: 503 },
    );
  try {
    const data = await requestApi(url);
    return NextResponse.json({
      ok: true,
      source: "tourapi",
      items: getItems(data)
        .map(normalize)
        .filter((item) => item.id && item.title),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        items: [],
        message: "관광정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 502 },
    );
  }
}
