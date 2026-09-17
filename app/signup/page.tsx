"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseBrowserEnv } from "@/lib/env";

function validateUserId(id: string): string | null {
  if (id.length < 4) return "아이디는 4자 이상이어야 합니다.";
  if (id.length > 20) return "아이디는 20자 이하여야 합니다.";
  if (!/^[a-zA-Z0-9_]+$/.test(id)) return "아이디는 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.";
  return null;
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const env = getSupabaseBrowserEnv();
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
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

    const idError = validateUserId(userId.trim());
    if (idError) {
      setMessage(idError);
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
          username: userId.trim(),
        },
      },
    });
    setLoading(false);

    if (error) {
      if (error.message.includes("already registered")) {
        setMessage("이미 사용 중인 이메일입니다.");
      } else {
        setMessage(error.message);
      }
      return;
    }

    setMessage("회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.");
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-panel">
          <p className="eyebrow">수원 든든패스</p>
          <h1>회원가입</h1>
          <p className="lead">아이디와 이메일로 계정을 만듭니다.</p>
          {!env.configured && <p className="notice">Supabase 프로젝트를 만든 뒤 환경변수를 넣어주세요.</p>}
        </section>
        <section className="auth-panel">
          <form className="auth-form" onSubmit={submit}>
            <label>이름<input value={name} onChange={(event) => setName(event.target.value)} placeholder="홍길동" required autoComplete="name" /></label>
            <label>
              아이디
              <input
                type="text"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                placeholder="영문, 숫자, 밑줄 4~20자"
                required
                autoComplete="username"
                minLength={4}
                maxLength={20}
              />
            </label>
            <label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@email.com" required autoComplete="email" /></label>
            <label>비밀번호<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상" required autoComplete="new-password" /></label>
            <button className="primary-action" type="submit" disabled={loading}>{loading ? "가입 중" : "회원가입"}</button>
            {message && <p className="notice">{message}</p>}
          </form>
          <p className="muted">이미 계정이 있나요? <Link href="/login">로그인</Link></p>
        </section>
      </div>
    </main>
  );
}
