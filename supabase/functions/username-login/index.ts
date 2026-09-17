import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const authMessage = "아이디 또는 비밀번호가 올바르지 않습니다.";
function reply(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
function key(name: string, legacy: string) {
  const keys = Deno.env.get(name);
  return (keys ? JSON.parse(keys).default : "") || Deno.env.get(legacy) || "";
}
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return reply({ error: "허용되지 않는 요청입니다." }, 405);
  try {
    const text = await request.text();
    if (text.length > 4096) return reply({ error: authMessage }, 400);
    const body = JSON.parse(text);
    const username =
      typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (
      !/^[a-zA-Z0-9_]{4,20}$/.test(username) ||
      !password ||
      password.length > 1024
    )
      return reply({ error: authMessage }, 400);
    const url = Deno.env.get("SUPABASE_URL") || "";
    const secret = key("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    const publishable = key("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    if (!url || !secret || !publishable)
      return reply({ error: "로그인 연결을 확인해 주세요." }, 503);
    const options = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    const admin = createClient(url, secret, options);
    const { data: profile, error: lookupError } = await admin
      .from("profiles")
      .select("email")
      .eq("username", username)
      .maybeSingle();
    if (lookupError)
      return reply({ error: "로그인 연결을 확인해 주세요." }, 503);
    if (!profile?.email) return reply({ error: authMessage }, 401);
    const auth = createClient(url, publishable, options);
    const { data, error } = await auth.auth.signInWithPassword({
      email: profile.email,
      password,
    });
    if (error || !data.session)
      return reply({ error: authMessage }, error?.status === 429 ? 429 : 401);
    return reply(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      200,
    );
  } catch {
    return reply({ error: authMessage }, 400);
  }
});
