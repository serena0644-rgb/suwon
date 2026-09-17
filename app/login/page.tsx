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

    const res = await fetch(`/api/auth/lookup?username=${encodeURIComponent(userId.trim())}`);
    if (!res.ok) {
      setLoading(false);
      setMessage("아이디 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    const { email } = await res.json() as { email: string };

    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setMessage("아이디 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    const uid = authData.user?.id;
    const { data: profile } = uid
      ? await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single()
      : { data: null };

    setLoading(false);

    const destination = profile?.role === "admin" ? "/admin" : "/";
    window.location.assign(destination);
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-panel">
          <p className="eyebrow">수원 든든패스</p>
          <h1>로그인</h1>
          <p className="lead">아이디와 비밀번호로 로그인합니다.</p>
          {!env.configured && <p className="notice">NEXT_PUBLIC_SUPABASE_URL과 publishable 또는 anon key가 필요합니다.</p>}
        </section>
        <section className="auth-panel">
          <form className="auth-form" onSubmit={submit}>
            <label>아이디<input type="text" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="아이디를 입력하세요" required autoComplete="username" /></label>
            <label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호" required autoComplete="current-password" /></label>
            <button className="primary-action" type="submit" disabled={loading}>{loading ? "확인 중" : "로그인"}</button>
            {message && <p className="notice">{message}</p>}
          </form>
          <p className="muted">아직 계정이 없나요? <Link href="/signup">회원가입</Link></p>
        </section>
      </div>
    </main>
  );
}
