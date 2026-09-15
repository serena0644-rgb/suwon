"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseBrowserEnv } from "@/lib/env";

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const env = getSupabaseBrowserEnv();
  const [name, setName] = useState("");
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          display_name: name,
        },
      },
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("회원가입이 완료되었습니다. 이메일 확인 설정이 켜져 있으면 메일 인증 후 로그인해주세요.");
    setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-panel">
          <p className="eyebrow">GO-SU</p>
          <h1>회원가입</h1>
          <p className="lead">계정 정보를 Supabase Auth에 안전하게 저장합니다.</p>
          {!env.configured && <p className="notice">Supabase 프로젝트를 만든 뒤 환경변수를 넣어주세요.</p>}
        </section>
        <section className="auth-panel">
          <form className="auth-form" onSubmit={submit}>
            <label>이름<input value={name} onChange={(event) => setName(event.target.value)} placeholder="홍길동" required /></label>
            <label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@email.com" required /></label>
            <label>비밀번호<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상" required /></label>
            <button className="primary-action" type="submit" disabled={loading}>{loading ? "가입 중" : "회원가입"}</button>
            {message && <p className="notice">{message}</p>}
          </form>
          <p className="muted">이미 계정이 있나요? <Link href="/login">로그인</Link></p>
        </section>
      </div>
    </main>
  );
}
