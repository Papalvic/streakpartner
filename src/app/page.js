import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logOut } from "@/app/actions/auth";
import { createMatch, acceptMatch, rejectMatch } from "@/app/actions/matches";
import NotificationBell from "@/app/components/NotificationBell";
import CreateMatchPanel from "@/app/components/CreateMatchPanel";
import Avatar from "@/app/components/Avatar";
import BottomNav from "@/app/components/BottomNav";
import {
  FlameIcon, CoinIcon, CheckIcon, PlusIcon, LogoutIcon, FireIcon, ChatIcon,
} from "@/app/components/Icons";

async function getDashboardData() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  const { data: players } = await supabase
    .from("profiles")
    .select("id, username, display_name, wins")
    .neq("id", user.id)
    .order("wins", { ascending: false })
    .limit(10);

  const { data: matches } = await supabase
    .from("matches")
    .select(
      `id, status, stake, settled, winner_id, created_at,
       challenger_id, opponent_id,
       challenger:profiles!matches_challenger_id_fkey(id, username, display_name, avatar_id),
       opponent:profiles!matches_opponent_id_fkey(id, username, display_name, avatar_id)`
    )
    .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const { data: leaderboard } = await supabase
    .from("profiles")
    .select("id, username, display_name, wins, avatar_id")
    .order("wins", { ascending: false })
    .limit(5);

  // Draw flags for completed matches (so draws never show as LOST).
  const completedIds = (matches || []).filter((m) => m.status === "completed").map((m) => m.id);
  const drawById = {};
  if (completedIds.length > 0) {
    const { data: results } = await supabase
      .from("match_results")
      .select("match_id, is_draw")
      .in("match_id", completedIds);
    (results || []).forEach((r) => (drawById[r.match_id] = !!r.is_draw));
  }

  return { user, profile, players, matches, leaderboard, drawById };
}

export default async function Dashboard() {
  const { user, profile, players, matches, leaderboard, drawById } = await getDashboardData();

  const isChallenger = (m) => m.challenger_id === user.id;
  const getOpp = (m) => (isChallenger(m) ? m.opponent : m.challenger);
  const getOppId = (m) => (isChallenger(m) ? m.opponent_id : m.challenger_id);

  const pendingMatches = matches?.filter((m) => m.status === "pending" && m.opponent_id === user.id);
  const activeMatches = matches?.filter((m) => m.status === "accepted");
  const completedMatches = matches?.filter((m) => m.status === "completed").slice(0, 5);

  const bal = profile?.balance ?? 0;
  const wins = profile?.wins ?? 0;
  const losses = profile?.losses ?? 0;
  const played = profile?.matches_played ?? 0;
  const trophies = profile?.tournament_wins ?? 0;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <FlameIcon size={20} />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white">
                Streak<span className="text-accent">Partner</span>
              </h1>
              <p className="text-[11px] font-medium text-slate-400">
                @{profile?.username || user.email?.split("@")[0]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell currentUserId={user.id} />
            <form action={logOut}>
              <button type="submit"
                className="flex items-center gap-1.5 rounded-lg border border-line bg-night-800 px-3 py-2 text-xs font-medium text-slate-300 hover:border-line-light hover:text-white transition-colors">
                <LogoutIcon size={15} />
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pt-4">
        {/* Balance hero */}
        <section className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-night-700 via-night-800 to-night-900 p-5 shadow-[0_0_40px_rgba(37,211,102,0.08)]">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">PromptCoin Balance</p>
              <div className="flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent">
                <FireIcon size={12} /> Streak
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <CoinIcon size={24} />
              </div>
              <p className="text-4xl font-black tracking-tight text-white">{bal.toLocaleString()}</p>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2">
              <Stat num={played} label="Matches" />
              <Stat num={wins} label="Wins" cls="text-accent" />
              <Stat num={losses} label="Losses" cls="text-red-400" />
              <Stat num={trophies} label="Trophies" cls="text-amber-400" />
            </div>
          </div>
        </section>

        {/* Play Match */}
        <section className="mt-5">
          <div className="g-card-press flex items-center gap-3 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <PlusIcon size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Play Match</h2>
              <p className="text-xs text-slate-400">Costs 5 PromptCoin · Winner takes the 10 pot</p>
            </div>
          </div>
          <div className="mt-2 g-card p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Search Opponent</p>
            <CreateMatchPanel />
            <p className="mt-3 text-[11px] text-slate-500">
              Stakes: <span className="text-accent">5 PromptCoin</span> each · Pot: <span className="text-white">10 PromptCoin</span>
            </p>
          </div>
        </section>

        {/* Global Chat card */}
        <section className="mt-5 g-card-press flex items-center gap-3 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <ChatIcon size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-white">Global Chat</h2>
            <p className="text-xs text-slate-400">Talk with other StreakPartner players</p>
          </div>
          <Link href="/chat" className="flex h-10 shrink-0 items-center rounded-xl bg-accent px-3 text-sm font-bold text-black hover:bg-accent-soft">
            Open →
          </Link>
        </section>

        {/* Incoming challenges */}
        {pendingMatches?.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Incoming Challenges</h2>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-black">
                {pendingMatches.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {pendingMatches.map((m) => {
                const opp = getOpp(m);
                return (
                  <div key={m.id} className="g-card animate-pop p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
                        {opp?.display_name?.[0] || opp?.username?.[0] || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-white">{opp?.display_name || opp?.username || "Player"}</p>
                        <p className="text-xs text-slate-400">@{opp?.username || "unknown"} · stake {m.stake} coins</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/matches/${m.id}`} className="rounded-xl border border-line bg-night-800 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white">
                          View
                        </Link>
                        <form action={acceptMatch}>
                          <input type="hidden" name="matchId" value={m.id} />
                          <button type="submit"
                            className="flex items-center gap-1 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black hover:bg-accent-soft transition-colors">
                            <CheckIcon size={14} /> Accept
                          </button>
                        </form>
                        <form action={rejectMatch}>
                          <input type="hidden" name="matchId" value={m.id} />
                          <button type="submit"
                            className="rounded-xl border border-line bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20 transition-colors">
                            Reject
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Active matches */}
        {activeMatches?.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Matches in Progress</h2>
            <div className="flex flex-col gap-3">
              {activeMatches.map((m) => {
                const opp = getOpp(m);
                return (
                  <div key={m.id} className="g-card-press block overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <Link href={`/profile/${getOppId(m)}`} className="flex min-w-0 flex-1 items-center gap-3 hover:underline">
                        <Avatar avatarId={opp?.avatar_id} size={40} className="shrink-0 rounded-xl" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{opp?.display_name || opp?.username || "Player"}</p>
                          <p className="truncate text-[10px] text-slate-500">@{opp?.username}</p>
                          <p className="text-xs text-slate-400">Pot: {m.stake * 2} coins · <span className="text-accent">In progress</span></p>
                        </div>
                      </Link>
                      <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">LIVE</span>
                    </div>
                    <Link href={`/matches/${m.id}`}
                      className="border-t border-line px-4 py-3 text-center text-xs font-semibold text-accent hover:bg-night-800">
                      Open Match Room →
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recent matches */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Recent Matches</h2>
            <a href="/matches" className="text-xs font-semibold text-accent">View all</a>
          </div>
          {completedMatches?.length > 0 ? (
            <div className="flex flex-col gap-2">
              {completedMatches.map((m) => {
                const opp = getOpp(m);
                const won = m.winner_id === user.id;
                const isDraw = !!drawById[m.id];
                return (
                  <div key={m.id} className="g-card-press flex items-center justify-between rounded-xl px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${isDraw ? "bg-blue-500/15 text-blue-400" : won ? "bg-accent/15 text-accent" : "bg-red-500/15 text-red-400"}`}>
                        {isDraw ? "D" : won ? "W" : "L"}
                      </div>
                      {/* Opponent identity links to profile */}
                      <Link href={`/profile/${getOppId(m)}`} className="flex items-center gap-2 hover:underline">
                        <Avatar avatarId={opp?.avatar_id} size={30} className="rounded-xl" />
                        <span>
                          <span className="block text-sm font-semibold text-white">{opp?.display_name || opp?.username || "Player"}</span>
                          <span className="block text-[10px] text-slate-500">@{opp?.username} · {new Date(m.created_at).toLocaleDateString()}</span>
                        </span>
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isDraw ? "bg-blue-500/15 text-blue-400" : won ? "bg-accent/15 text-accent" : "bg-red-500/15 text-red-400"}`}>
                        {isDraw ? "DRAW · STAKE RETURNED" : won ? `WON +${m.stake * 2}` : `LOST -${m.stake}`}
                      </span>
                      <Link href={`/matches/${m.id}`} className="rounded-lg border border-line bg-night-800 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white">
                        View
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="g-card rounded-2xl p-6 text-center">
              <p className="text-3xl">⚽</p>
              <p className="mt-2 text-sm text-slate-400">No matches yet. Challenge another player to get started!</p>
            </div>
          )}
        </section>

        {/* Leaderboard preview */}
        {leaderboard?.length > 0 && (
          <section className="mt-6 pb-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Leaderboard</h2>
              <a href="/leaderboard" className="text-xs font-semibold text-accent">View all</a>
            </div>
            <div className="g-card divide-y divide-line overflow-hidden">
              {leaderboard?.slice(0, 5).map((p, idx) => {
                const me = p.id === user.id;
                return (
                  <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${me ? "bg-accent-glow" : ""}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      idx === 0 ? "bg-amber-400/20 text-amber-400" :
                      idx === 1 ? "bg-slate-300/20 text-slate-300" :
                      idx === 2 ? "bg-orange-500/20 text-orange-400" : "bg-night-700 text-slate-400"}`}>
                      {idx + 1}
                    </span>
                    <Link href={`/profile/${p.id}`} className="flex items-center gap-2 hover:underline">
                      <Avatar avatarId={p.avatar_id} size={30} className="shrink-0 rounded-xl" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {me ? "You" : p.display_name || p.username}
                          {me && <span className="ml-1.5 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">YOU</span>}
                        </p>
                        <p className="text-[11px] text-slate-500">@{p.username}</p>
                      </div>
                    </Link>
                    <div className="ml-auto text-right">
                      <p className="text-sm font-bold text-white">{p.wins}</p>
                      <p className="text-[10px] text-slate-500">wins</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <BottomNav active="home" />
    </div>
  );
}

function Stat({ num, label, cls = "" }) {
  return (
    <div className="rounded-xl border border-line bg-night-900/60 p-2.5 text-center">
      <p className={`text-lg font-bold ${cls || "text-white"}`}>{num}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}