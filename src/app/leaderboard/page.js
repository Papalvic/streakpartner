import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/app/components/BottomNav";
import { LeaderboardIcon } from "@/app/components/Icons";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: leaderboard } = await supabase
    .from("profiles")
    .select("id, username, display_name, wins, losses, matches_played, tournament_wins")
    .order("wins", { ascending: false })
    .limit(50);

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <LeaderboardIcon size={20} />
            </div>
            <h1 className="text-base font-extrabold text-white">Leaderboard</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg px-4 pt-4">
        <div className="g-card divide-y divide-line overflow-hidden rounded-2xl">
          {leaderboard?.length > 0 ? (
            leaderboard.map((p, idx) => {
              const me = p.id === user.id;
              return (
                <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${me ? "bg-accent-glow" : ""}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    idx === 0 ? "bg-amber-400/20 text-amber-400" :
                    idx === 1 ? "bg-slate-300/20 text-slate-300" :
                    idx === 2 ? "bg-orange-500/20 text-orange-400" : "bg-night-700 text-slate-400"}`}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {me ? "You" : p.display_name || p.username}
                      {me && <span className="ml-1.5 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">YOU</span>}
                    </p>
                    <p className="text-[11px] text-slate-500">@{p.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{p.wins} <span className="text-[10px] font-medium text-slate-500">wins</span></p>
                    <p className="text-[10px] text-slate-500">{p.matches_played ?? 0} played</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <p className="text-5xl">🏆</p>
              <p className="mt-3 text-sm text-slate-400">No players on the leaderboard yet.</p>
            </div>
          )}
        </div>
      </main>
      <BottomNav active="leaderboard" />
    </div>
  );
}