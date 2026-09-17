import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "username이 필요합니다." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경변수를 먼저 설정해주세요." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("username", username.trim())
    .single();

  if (error || !data?.email) {
    return NextResponse.json({ error: "존재하지 않는 아이디입니다." }, { status: 404 });
  }

  return NextResponse.json({ email: data.email });
}
