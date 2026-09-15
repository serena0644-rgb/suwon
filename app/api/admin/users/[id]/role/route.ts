import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 환경변수가 없습니다.", status: 500 } as const;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다.", status: 401 } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "관리자 권한이 필요합니다.", status: 403 } as const;
  return { supabase, user } as const;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const { role } = await request.json();

  if (role !== "user" && role !== "admin") {
    return NextResponse.json({ error: "허용되지 않는 권한입니다." }, { status: 400 });
  }

  if (id === auth.user.id && role !== "admin") {
    return NextResponse.json({ error: "본인 관리자 권한은 직접 해제할 수 없습니다." }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("profiles")
    .update({ role })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
