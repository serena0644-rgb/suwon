"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseBrowserEnv } from "@/lib/env";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const env = getSupabaseBrowserEnv();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Supabase 환경변수를 먼저 설정해주세요.");
      return;
    }

    setLoading(true);

    setMessage("");
    try {
      const { data: tokens, error: loginError } =
        await supabase.functions.invoke("username-login", {
          body: { username: userId.trim(), password },
        });
      if (loginError || !tokens?.access_token || !tokens?.refresh_token) {
        setMessage("아이디 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      const { data: authData, error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (error || !authData.user) {
        setMessage("로그인 상태를 저장하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();
      window.location.assign(profile?.role === "admin" ? "/admin" : "/");
    } catch {
      setMessage("로그인 연결을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-panel">
          <p className="eyebrow">수원 든든패스</p>
          <h1>로그인</h1>
          <p className="lead">아이디와 비밀번호로 로그인합니다.</p>
          {!env.configured && (
            <p className="notice">
              NEXT_PUBLIC_SUPABASE_URL과 publishable 또는 anon key가 필요합니다.
            </p>
          )}
        </section>
        <section className="auth-panel">
          <form className="auth-form" onSubmit={submit}>
            <label>
              아이디
              <input
                type="text"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                placeholder="아이디를 입력하세요"
                required
                autoComplete="username"
              />
            </label>
            <label>
              비밀번호
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호"
                required
                autoComplete="current-password"
              />
            </label>
            <button className="primary-action" type="submit" disabled={loading}>
              {loading ? "확인 중" : "로그인"}
            </button>
            {message && <p className="notice">{message}</p>}
          </form>
          <p className="muted">
            아직 계정이 없나요? <Link href="/signup">회원가입</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
