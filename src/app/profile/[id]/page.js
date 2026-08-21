import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/app/components/BottomNav";
import Avatar from "@/app/components/Avatar";

export default async function PublicProfilePage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch the target player profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!profile) redirect("/feed");

  const bal = profile.balance ?? 0;
  const wins = profile.wins ?? 0;
  const losses = profile.losses ?? 0;
  const played = profile.matches_played ?? 0;
  const trophies = profile.tournament_wins ?? 0;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

  // Recent match history.
  const { data: matches } = await supabase
    .from("matches")
    .select(
      `id, status, stake, winner_id, created_at, challenger_id, opponent_id,
       challenger:profiles!matches_challenger_id_fkey(username, display_name),
       opponent:profiles!matches_opponent_id_fkey(username, display_name)`
    )
    .or(`challenger_id.eq.${id},opponent_id.eq.${id}`)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(5);

  const isChallenger = (m) => m.challenger_id === id;
  const getOpp = (m) => (isChallenger(m) ? m.opponent : m.challenger);

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Link href="/leaderboard" className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-night-800 text-slate-300 hover:text-white transition-colors">
              ←
            </Link>
            <h1 className="text-base font-extrabold text-white">Player</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pt-4">
        {/* Identity card */}
        <section className="g-card relative overflow-hidden rounded-2xl p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-2xl" />
          <div className="flex items-center gap-4">
            <Avatar avatarId={profile.avatar_id} size={64} className="shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold text-white">
                {profile.display_name || profile.username}
              </h2>
              <p className="text-xs text-slate-400">@{profile.username}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Joined {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Balance" value={bal.toLocaleString()} accent="text-accent" icon="🪙" />
          <Stat label="Matches" value={played} icon="⚽" />
          <Stat label="Tournament Matches" value={profile.tournament_matches_played ?? 0} icon="🛡️" accent="text-blue-400" />
          <Stat label="Wins" value={wins} accent="text-accent" icon="✅" />
          <Stat label="Losses" value={losses} accent="text-red-400" icon="❌" />
          <Stat label="Trophies" value={trophies} accent="text-amber-400" icon="🏆" />
          <Stat label="Win Rate" value={`${winRate}%`} icon="📊" />
        </section>

        {/* Recent match history */}
        <section className="mt-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Recent Matches</h2>
          {matches?.length > 0 ? (
            <div className="flex flex-col gap-2">
              {matches.map((m) => {
                const opp = getOpp(m);
                const won = m.winner_id === id;
                return (
                  <Link key={m.id} href={`/matches/${m.id}`} className="g-card-press flex items-center justify-between rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${won ? "bg-accent/15 text-accent" : "bg-red-500/15 text-red-400"}`}>
                        {won ? "W" : "L"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          vs {opp?.display_name || opp?.username || "Player"}
                        </p>
                        <p className="text-[11px] text-slate-500">{new Date(m.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${won ? "bg-accent/15 text-accent" : "bg-red-500/15 text-red-400"}`}>
                      {won ? "WON" : "LOST"} · {won ? `+${m.stake * 2}` : `-${m.stake}`}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="g-card rounded-2xl p-6 text-center">
              <p className="text-3xl">⚽</p>
              <p className="mt-2 text-sm text-slate-400">No completed matches yet.</p>
            </div>
          )}
        </section>
      </main>

      <BottomNav active="home" />
    </div>
  );
}

function Stat({ label, value, icon, accent = "" }) {
  return (
    <div className="g-card rounded-2xl p-4">
      <p className="text-xl">{icon}</p>
      <p className={`mt-1 text-xl font-bold ${accent || "text-white"}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{label}</p>
    </div>
  );
}