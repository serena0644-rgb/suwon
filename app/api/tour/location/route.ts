import { NextResponse } from "next/server";
import { TOUR_BASE_URL, buildUrl, fallback, getItems, normalize, requestApi } from "@/lib/tour/api";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mapX = params.get("mapX") || "127.014028";
  const mapY = params.get("mapY") || "37.281889";
  const radius = params.get("radius") || "2000";
  const url = buildUrl(TOUR_BASE_URL, "locationBasedList2", { mapX, mapY, radius });

  if (!url) {
    return NextResponse.json({ ok: true, source: "sample", items: fallback("수원") });
  }

  try {
    const data = await requestApi(url);
    return NextResponse.json({ ok: true, source: "tourapi", items: getItems(data).map(normalize) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, source: "tourapi", message: error instanceof Error ? error.message : "API 오류", items: fallback("수원") },
      { status: 500 },
    );
  }
}
