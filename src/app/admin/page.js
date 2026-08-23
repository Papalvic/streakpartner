import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/app/components/BottomNav";
import {
  adminSetBanned,
  adminSetTournamentPermission,
  adminUpdateReportStatus,
} from "@/app/actions/admin";

const PAGE_SIZE = 10;

export default async function AdminPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "admin") redirect("/");

  const params = await searchParams;
  const tab = params.tab === "users" ? "users" : "reports";
  const page = Math.max(1, parseInt(params.page) || 1);
  const q = String(params.q || "").trim();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Reports list (paginated)
  let reports = [];
  let reportCount = 0;
  if (tab === "reports") {
    const { count } = await supabase
      .from("reports")
      .select("id", { count: "exact", head: true });
    reportCount = count || 0;
    const { data } = await supabase
      .from("reports")
      .select(
        `id, reason, image_url, status, created_at,
         reporter:profiles!reports_reporter_id_fkey(username, display_name),
         reported:profiles!reports_reported_user_id_fkey(username, display_name)`
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    reports = data || [];
  }

  // Users list (searchable + paginated)
  let users = [];
  let userCount = 0;
  if (tab === "users") {
    let query = supabase.from("profiles").select(
      "id, username, display_name, avatar_id, is_banned, can_create_tournaments, role, created_at",
      { count: "exact" }
    );
    if (q.length >= 2) {
      query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
    }
    const { count, data } = await query
      .order("created_at", { ascending: false })
      .range(from, to);
    userCount = count || 0;
    users = data || [];
  }

  const total = tab === "reports" ? reportCount : userCount;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-night-800 text-slate-300 hover:text-white">
              ←
            </Link>
            <h1 className="text-base font-extrabold text-white">Admin</h1>
          </div>
          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold text-accent">
            ADMIN
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pt-4">
        {/* Tabs */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Link
            href="/admin?tab=reports"
            className={`flex h-11 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
              tab === "reports"
                ? "bg-accent text-black"
                : "border border-line bg-night-800 text-slate-300"
            }`}
          >
            Reports · {reportCount}
          </Link>
          <Link
            href="/admin?tab=users"
            className={`flex h-11 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
              tab === "users"
                ? "bg-accent text-black"
                : "border border-line bg-night-800 text-slate-300"
            }`}
          >
            Users · {userCount}
          </Link>
        </div>

        {tab === "users" && (
          <form method="get" action="/admin" className="mb-3 flex gap-2">
            <input type="hidden" name="tab" value="users" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search username or display name"
              className="h-10 flex-1 rounded-xl border border-line bg-night-800 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent"
            />
            <button type="submit" className="h-10 rounded-xl bg-accent px-4 text-sm font-bold text-black">
              Search
            </button>
          </form>
        )}

        {tab === "reports" ? (
          reports.length === 0 ? (
            <p className="g-card rounded-2xl p-6 text-center text-sm text-slate-400">No reports yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {reports.map((r) => (
                <div key={r.id} className="g-card rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-white">
                      @{r.reported?.username || "Unknown"}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.status === "open"
                          ? "bg-yellow-500/15 text-yellow-400"
                          : r.status === "resolved"
                            ? "bg-accent/15 text-accent"
                            : "bg-night-700 text-slate-400"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">by @{r.reporter?.username}</p>
                  <p className="mt-2 break-words text-sm text-white">{r.reason}</p>
                  {r.image_url && (
                    <a href={r.image_url} target="_blank" rel="noreferrer"
                      className="mt-1 inline-block text-xs font-bold text-accent hover:underline">
                      View picture →
                    </a>
                  )}
                  <p className="mt-1 text-[10px] text-slate-500">{new Date(r.created_at).toLocaleString()}</p>
                  <form action={adminUpdateReportStatus} className="mt-2 flex gap-2">
                    <input type="hidden" name="reportId" value={r.id} />
                    <select
                      name="status"
                      defaultValue={r.status}
                      className="h-9 flex-1 rounded-lg border border-line bg-night-800 px-2 text-xs text-white outline-none"
                    >
                      <option value="open">open</option>
                      <option value="resolved">resolved</option>
                      <option value="dismissed">dismissed</option>
                    </select>
                    <button type="submit" className="h-9 rounded-lg bg-accent px-3 text-xs font-bold text-black">
                      Update
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )
        ) : users.length === 0 ? (
          <p className="g-card rounded-2xl p-6 text-center text-sm text-slate-400">No users found.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map((u) => (
              <div key={u.id} className="g-card rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/profile/${u.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{u.display_name || u.username}</p>
                    <p className="truncate text-[11px] text-slate-500">@{u.username}</p>
                  </Link>
                  {u.is_banned && (
                    <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
                      BLOCKED
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <form action={adminSetBanned}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="banned" value={u.is_banned ? "0" : "1"} />
                    <button type="submit"
                      className="h-9 w-full rounded-lg bg-red-500/15 text-xs font-bold text-red-300 hover:bg-red-500/25">
                      {u.is_banned ? "Unblock" : "Block"}
                    </button>
                  </form>
                  <form action={adminSetTournamentPermission}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="can" value={u.can_create_tournaments ? "0" : "1"} />
                    <button type="submit"
                      className="h-9 w-full rounded-lg bg-accent/15 text-xs font-bold text-accent hover:bg-accent/25">
                      {u.can_create_tournaments ? "Revoke Tournaments" : "Grant Tournaments"}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between gap-2 pb-4">
            {page > 1 ? (
              <Link href={`/admin?tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${page - 1}`}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-line bg-night-800 text-sm font-bold text-slate-300 hover:text-white">
                ← Prev
              </Link>
            ) : (
              <span className="h-10 flex-1" />
            )}
            <span className="shrink-0 text-xs text-slate-500">Page {page} / {totalPages}</span>
            {page < totalPages ? (
              <Link href={`/admin?tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${page + 1}`}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-line bg-night-800 text-sm font-bold text-slate-300 hover:text-white">
                Next →
              </Link>
            ) : (
              <span className="h-10 flex-1" />
            )}
          </div>
        )}
      </main>

      <BottomNav active="profile" />
    </div>
  );
}