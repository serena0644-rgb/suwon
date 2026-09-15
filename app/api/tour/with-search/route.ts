import { NextResponse } from "next/server";
import { WITH_BASE_URL, buildUrl, fallback, getItems, normalize, requestApi } from "@/lib/tour/api";

export async function GET(request: Request) {
  const keyword = new URL(request.url).searchParams.get("keyword")?.trim() || "수원";
  const url = buildUrl(WITH_BASE_URL, "searchKeyword2", { keyword });

  if (!url) {
    return NextResponse.json({ ok: true, source: "sample", items: fallback(keyword) });
  }

  try {
    const data = await requestApi(url);
    return NextResponse.json({ ok: true, source: "withapi", items: getItems(data).map(normalize) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, source: "withapi", message: error instanceof Error ? error.message : "API 오류", items: fallback(keyword) },
      { status: 500 },
    );
  }
}
