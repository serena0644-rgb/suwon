import { NextResponse } from "next/server";
import {
  TOUR_BASE_URL,
  WITH_BASE_URL,
  buildUrl,
  getItems,
  normalize,
  requestApi,
} from "@/lib/tour/api";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mapX = params.get("mapX") || "";
  const mapY = params.get("mapY") || "";
  const radius = params.get("radius") || "2000";
  const withAccessibility = params.get("source") === "with";
  if (
    !mapX ||
    !mapY ||
    !Number.isFinite(Number(mapX)) ||
    !Number.isFinite(Number(mapY)) ||
    Math.abs(Number(mapX)) > 180 ||
    Math.abs(Number(mapY)) > 90 ||
    !Number.isFinite(Number(radius)) ||
    Number(radius) <= 0 ||
    Number(radius) > 20000
  )
    return NextResponse.json(
      { ok: false, items: [], message: "유효한 위치와 반경이 필요합니다." },
      { status: 400 },
    );
  const url = buildUrl(
    withAccessibility ? WITH_BASE_URL : TOUR_BASE_URL,
    "locationBasedList2",
    { mapX, mapY, radius },
  );
  if (!url)
    return NextResponse.json(
      { ok: false, items: [], message: "관광정보 연결이 준비되지 않았습니다." },
      { status: 503 },
    );
  try {
    const data = await requestApi(url);
    return NextResponse.json({
      ok: true,
      source: withAccessibility ? "withapi" : "tourapi",
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
