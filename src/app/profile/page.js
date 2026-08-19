import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logOut } from "@/app/actions/auth";
import BottomNav from "@/app/components/BottomNav";
import { UserIcon, CoinIcon, LogoutIcon } from "@/app/components/Icons";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const bal = profile?.balance ?? 0;
  const wins = profile?.wins ?? 0;
  const losses = profile?.losses ?? 0;
  const played = profile?.matches_played ?? 0;
  const trophies = profile?.tournament_wins ?? 0;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <UserIcon size={20} />
            </div>
            <h1 className="text-base font-extrabold text-white">Profile</h1>
          </div>
          <form action={logOut}>
            <button type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-line bg-night-800 px-3 py-2 text-xs font-medium text-slate-300 hover:border-line-light hover:text-white transition-colors">
              <LogoutIcon size={15} />
              Logout
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pt-4">
        {/* Identity card */}
        <section className="g-card relative overflow-hidden rounded-2xl p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-2xl" />
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-2xl font-bold text-accent">
              {profile?.username?.[0]?.toUpperCase() || "P"}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold text-white">
                {profile?.display_name || profile?.username}
              </h2>
              <p className="text-xs text-slate-400">@{profile?.username}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-night-900/60 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <CoinIcon size={18} />
            </div>
            <div>
              <p className="text-lg font-black text-white">{bal.toLocaleString()}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">PromptCoin</p>
            </div>
          </div>
        </section>

        {/* Stats grid */}
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">Career Stats</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Matches Played" value={played} icon="⚽" />
            <StatCard label="Wins" value={wins} icon="✅" accent="text-accent" />
            <StatCard label="Losses" value={losses} icon="❌" accent="text-red-400" />
            <StatCard label="Win Rate" value={`${winRate}%`} icon="📊" />
            <StatCard label="Tournament Wins" value={trophies} icon="🏆" accent="text-amber-400" />
            <StatCard label="Balance" value={bal.toLocaleString()} icon="🪙" accent="text-accent" />
          </div>
        </section>
      </main>

      <BottomNav active="profile" />
    </div>
  );
}

function StatCard({ label, value, icon, accent = "" }) {
  return (
    <div className="g-card rounded-2xl p-4">
      <p className="text-xl">{icon}</p>
      <p className={`mt-1 text-xl font-bold ${accent || "text-white"}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{label}</p>
    </div>
  );
}