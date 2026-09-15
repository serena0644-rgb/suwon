import { NextResponse } from "next/server";
import { TOUR_BASE_URL, WITH_BASE_URL, buildUrl, getItems, requestApi, stripHtml } from "@/lib/tour/api";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const contentId = params.get("contentId")?.trim();
  const contentTypeId = params.get("contentTypeId")?.trim() || "";

  if (!contentId) {
    return NextResponse.json({ ok: false, message: "contentId가 필요합니다." }, { status: 400 });
  }

  const commonUrl = buildUrl(TOUR_BASE_URL, "detailCommon2", {
    contentId,
    contentTypeId,
    defaultYN: "Y",
    firstImageYN: "Y",
    areacodeYN: "Y",
    catcodeYN: "Y",
    addrinfoYN: "Y",
    mapinfoYN: "Y",
    overviewYN: "Y",
  });
  const withUrl = buildUrl(WITH_BASE_URL, "detailWithTour2", { contentId, contentTypeId });

  if (!commonUrl || !withUrl) {
    return NextResponse.json({
      ok: true,
      source: "sample",
      detail: { title: "상세 정보", overview: "Supabase와 TourAPI 환경변수를 설정하면 실제 상세 정보가 표시됩니다." },
    });
  }

  const [commonData, withData] = await Promise.allSettled([requestApi(commonUrl), requestApi(withUrl)]);
  const common = commonData.status === "fulfilled" ? getItems(commonData.value)[0] || {} : {};
  const withTour = withData.status === "fulfilled" ? getItems(withData.value)[0] || {} : {};

  return NextResponse.json({
    ok: true,
    source: "tourapi",
    detail: {
      title: common.title || "상세 정보",
      overview: stripHtml(common.overview || ""),
      homepageText: stripHtml(common.homepage || ""),
      tel: common.tel || "",
      parking: withTour.parking || "",
      route: withTour.route || "",
      restroom: withTour.restroom || "",
      wheelchair: withTour.wheelchair || "",
      elevator: withTour.elevator || "",
    },
  });
}
