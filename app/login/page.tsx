"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseBrowserEnv } from "@/lib/env";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const env = getSupabaseBrowserEnv();
  const [email, setEmail] = useState("");
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
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    const userId = authData.user?.id;
    const { data: profile } = userId
      ? await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single()
      : { data: null };

    setLoading(false);

    const destination = profile?.role === "admin" ? "/admin" : "/";

    // Force a full navigation so Supabase auth cookies are available to the
    // /admin route guard before the protected page loads.
    window.location.assign(destination);
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-panel">
          <p className="eyebrow">수원 든든패스</p>
          <h1>로그인</h1>
          <p className="lead">Supabase Auth로 실제 계정을 확인합니다.</p>
          {!env.configured && <p className="notice">NEXT_PUBLIC_SUPABASE_URL과 publishable 또는 anon key가 필요합니다.</p>}
        </section>
        <section className="auth-panel">
          <form className="auth-form" onSubmit={submit}>
            <label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@email.com" required /></label>
            <label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호" required /></label>
            <button className="primary-action" type="submit" disabled={loading}>{loading ? "확인 중" : "로그인"}</button>
            {message && <p className="notice">{message}</p>}
          </form>
          <p className="muted">아직 계정이 없나요? <Link href="/signup">회원가입</Link></p>
        </section>
      </div>
    </main>
  );
}
