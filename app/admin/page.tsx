"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseBrowserEnv } from "@/lib/env";

type Report = {
  admin_note: string | null;
  content: string;
  created_at: string;
  id: string;
  status: "pending" | "approved" | "rejected";
  user_id: string;
};

type Profile = {
  created_at: string;
  display_name: string | null;
  email: string | null;
  id: string;
  role: "user" | "admin";
};

type AdminSection = "dashboard" | "reports" | "parking" | "places" | "users" | "settings";

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const env = getSupabaseBrowserEnv();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<AdminSection>("reports");

  useEffect(() => {
    async function boot() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData.user;
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .single();
      const admin = profile?.role === "admin";
      setIsAdmin(admin);

      if (admin) {
        await Promise.all([loadReports(), loadProfiles()]);
      }
      setLoading(false);
    }

    void boot();
  }, [supabase]);

  async function loadReports() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("reports")
      .select("id, user_id, content, status, admin_note, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setReports((data || []) as Report[]);
  }

  async function updateStatus(id: string, status: Report["status"]) {
    if (!supabase) return;
    const { error } = await supabase.from("reports").update({ status }).eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`제보를 ${status === "approved" ? "승인" : status === "rejected" ? "반려" : "대기"} 처리했습니다.`);
    await loadReports();
  }

  async function removeReport(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("제보를 삭제했습니다.");
    await loadReports();
  }

  async function loadProfiles() {
    const response = await fetch("/api/admin/users");
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "사용자 목록을 불러오지 못했습니다.");
      return;
    }

    setProfiles(data.profiles || []);
  }

  async function updateProfileRole(id: string, role: Profile["role"]) {
    const response = await fetch(`/api/admin/users/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "권한을 변경하지 못했습니다.");
      return;
    }

    setMessage(role === "admin" ? "관리자로 승격했습니다." : "일반 사용자로 변경했습니다.");
    await loadProfiles();
  }

  async function signOut() {
    await supabase?.auth.signOut();
    window.location.href = "/";
  }

  const pendingCount = reports.filter((report) => report.status === "pending").length;
  const approvedCount = reports.filter((report) => report.status === "approved").length;
  const rejectedCount = reports.filter((report) => report.status === "rejected").length;
  const adminCount = profiles.filter((profile) => profile.role === "admin").length;

  const adminMenu: { id: AdminSection; label: string }[] = [
    { id: "dashboard", label: "📊 대시보드" },
    { id: "reports", label: "📢 제보 관리" },
    { id: "parking", label: "🅿 주차장 관리" },
    { id: "places", label: "🏛 관광지 관리" },
    { id: "users", label: "👥 사용자 관리" },
    { id: "settings", label: "⚙️ 설정" },
  ];

  function reportStatusLabel(status: Report["status"]) {
    if (status === "approved") return "게시됨";
    if (status === "rejected") return "삭제됨";
    return "미처리";
  }

  function reportPlace(content: string) {
    const places = ["행궁광장", "장안문", "화성박물관", "팔달문", "화성행궁", "수원화성"];
    return places.find((place) => content.includes(place)) || "수원";
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <Link href="/" className="admin-brand">🏰 수원 든든패스</Link>
        <span className="admin-pill">관리자</span>
        <div className="admin-account">
          <span>{user?.email || "admin@suwon.go.kr"}</span>
          <button type="button" onClick={signOut}>로그아웃</button>
        </div>
      </header>

      <aside className="admin-sidebar">
        <p className="admin-menu-title">관리 메뉴</p>
        {adminMenu.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`admin-menu-item ${activeSection === item.id ? "is-active" : ""}`}
            onClick={() => setActiveSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </aside>

      <section className="admin-content">
        {!env.configured && <p className="notice">Supabase 환경변수가 없어 관리자 기능을 사용할 수 없습니다.</p>}
        {loading && <p className="notice">관리자 권한 확인 중입니다.</p>}
        {!loading && !user && <p className="notice">관리자 페이지는 로그인 후 접근할 수 있습니다. <Link href="/login">로그인</Link></p>}
        {!loading && user && !isAdmin && <p className="notice">현재 계정은 관리자 권한이 없습니다.</p>}
        {message && <p className="notice">{message}</p>}

        {isAdmin && activeSection === "reports" && (
          <>
            <div className="admin-heading">
              <div>
                <h1>제보 관리</h1>
                <p>사용자가 등록한 시설 상태 제보를 검토하고 게시 또는 삭제할 수 있습니다.</p>
              </div>
              <button className="admin-refresh" type="button" onClick={loadReports}>새로고침</button>
            </div>

            <div className="admin-stats">
              <article className="admin-stat is-total"><strong>{reports.length}</strong><span>전체 제보</span></article>
              <article className="admin-stat is-pending"><strong>{pendingCount}</strong><span>미처리</span></article>
              <article className="admin-stat is-approved"><strong>{approvedCount}</strong><span>게시됨</span></article>
              <article className="admin-stat is-rejected"><strong>{rejectedCount}</strong><span>삭제됨</span></article>
            </div>

            <div className="admin-table-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>번호</th>
                    <th>제보 내용</th>
                    <th>제보자</th>
                    <th>제보 날짜</th>
                    <th>장소</th>
                    <th>상태</th>
                    <th>게시 / 삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report, index) => (
                    <tr key={report.id}>
                      <td>{String(index + 1).padStart(3, "0")}</td>
                      <td className="admin-main-cell">{report.content}</td>
                      <td>{report.user_id.slice(0, 6)}</td>
                      <td>{new Date(report.created_at).toISOString().slice(0, 10)}</td>
                      <td>{reportPlace(report.content)}</td>
                      <td><span className={`admin-status is-${report.status}`}>{reportStatusLabel(report.status)}</span></td>
                      <td>
                        <div className="admin-actions">
                          <button type="button" className="admin-publish" onClick={() => updateStatus(report.id, "approved")}>게시</button>
                          <button type="button" className="admin-delete" onClick={() => removeReport(report.id)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!reports.length && (
                    <tr>
                      <td colSpan={7} className="admin-empty">아직 제보가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {isAdmin && activeSection === "users" && (
          <>
            <div className="admin-heading">
              <div>
                <h1>사용자 관리</h1>
                <p>기존 관리자만 사용자 권한을 확인하고 관리자 승격을 처리할 수 있습니다.</p>
              </div>
              <button className="admin-refresh" type="button" onClick={loadProfiles}>새로고침</button>
            </div>

            <div className="admin-stats">
              <article className="admin-stat is-total"><strong>{profiles.length}</strong><span>전체 사용자</span></article>
              <article className="admin-stat is-approved"><strong>{adminCount}</strong><span>관리자</span></article>
              <article className="admin-stat is-pending"><strong>{profiles.length - adminCount}</strong><span>일반 사용자</span></article>
            </div>

            <div className="admin-table-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>번호</th>
                    <th>이름</th>
                    <th>이메일</th>
                    <th>가입일</th>
                    <th>권한</th>
                    <th>권한 변경</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile, index) => (
                    <tr key={profile.id}>
                      <td>{String(index + 1).padStart(3, "0")}</td>
                      <td className="admin-main-cell">{profile.display_name || "이름 없음"}</td>
                      <td>{profile.email || "이메일 없음"}</td>
                      <td>{new Date(profile.created_at).toISOString().slice(0, 10)}</td>
                      <td><span className={`admin-status is-${profile.role === "admin" ? "approved" : "pending"}`}>{profile.role === "admin" ? "관리자" : "일반"}</span></td>
                      <td>
                        <div className="admin-actions">
                          <button type="button" className="admin-publish" disabled={profile.role === "admin"} onClick={() => updateProfileRole(profile.id, "admin")}>승격</button>
                          <button type="button" className="admin-delete" disabled={profile.role === "user" || profile.id === user?.id} onClick={() => updateProfileRole(profile.id, "user")}>해제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!profiles.length && (
                    <tr>
                      <td colSpan={6} className="admin-empty">아직 사용자가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {isAdmin && !["reports", "users"].includes(activeSection) && (
          <div className="admin-placeholder">
            <h1>{adminMenu.find((item) => item.id === activeSection)?.label.replace(/^[^\s]+ /, "")}</h1>
            <p>이 메뉴는 화면 구조를 위해 준비되어 있으며, 현재는 제보 관리와 사용자 관리 기능을 먼저 연결했습니다.</p>
          </div>
        )}
      </section>
    </main>
  );
}
