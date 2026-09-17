import { NextResponse } from "next/server";
import {
  TOUR_BASE_URL,
  WITH_BASE_URL,
  buildUrl,
  getItems,
  requestApi,
  stripHtml,
} from "@/lib/tour/api";
export async function GET(request: Request) {
  const contentId = new URL(request.url).searchParams.get("contentId")?.trim();
  if (!contentId || !/^\d+$/.test(contentId))
    return NextResponse.json(
      { ok: false, message: "유효한 contentId가 필요합니다." },
      { status: 400 },
    );
  const commonUrl = buildUrl(TOUR_BASE_URL, "detailCommon2", { contentId });
  const withUrl = buildUrl(WITH_BASE_URL, "detailWithTour2", { contentId });
  if (!commonUrl || !withUrl)
    return NextResponse.json(
      {
        ok: false,
        detail: null,
        message: "관광정보 연결이 준비되지 않았습니다.",
      },
      { status: 503 },
    );
  const [commonResult, withResult] = await Promise.allSettled([
    requestApi(commonUrl),
    requestApi(withUrl),
  ]);
  if (commonResult.status === "rejected" && withResult.status === "rejected")
    return NextResponse.json(
      { ok: false, detail: null, message: "시설정보를 불러오지 못했습니다." },
      { status: 502 },
    );
  const common =
    commonResult.status === "fulfilled"
      ? getItems(commonResult.value)[0] || {}
      : {};
  const facilities =
    withResult.status === "fulfilled"
      ? getItems(withResult.value)[0] || {}
      : {};
  const fields = [
    "parking",
    "route",
    "restroom",
    "wheelchair",
    "elevator",
    "exit",
    "publictransport",
    "guidehuman",
    "helpdog",
    "stroller",
  ];
  return NextResponse.json({
    ok: true,
    source: "tourapi",
    accessibilityAvailable: withResult.status === "fulfilled",
    detail: {
      title: common.title || "",
      overview: stripHtml(common.overview || ""),
      tel: common.tel || "",
      ...Object.fromEntries(
        fields.map((field) => [field, stripHtml(facilities[field] || "")]),
      ),
    },
  });
}
