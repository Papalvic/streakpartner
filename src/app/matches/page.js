import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/app/components/BottomNav";
import { SwordsIcon } from "@/app/components/Icons";

export default async function MatchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: matches } = await supabase
    .from("matches")
    .select(
      `id, status, stake, settled, winner_id, created_at,
       challenger_id, opponent_id,
       challenger:profiles!matches_challenger_id_fkey(username, display_name),
       opponent:profiles!matches_opponent_id_fkey(username, display_name)`
    )
    .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(50);

  const isChallenger = (m) => m.challenger_id === user.id;
  const getOpp = (m) => (isChallenger(m) ? m.opponent : m.challenger);

  const statusBadge = {
    pending: { label: "Pending", cls: "bg-yellow-500/15 text-yellow-400" },
    accepted: { label: "In Progress", cls: "bg-accent/15 text-accent" },
    completed: { label: "Completed", cls: "bg-blue-500/15 text-blue-400" },
    cancelled: { label: "Cancelled", cls: "bg-red-500/15 text-red-400" },
  };

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <SwordsIcon size={20} />
            </div>
            <h1 className="text-base font-extrabold text-white">Matches</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg px-4 pt-4">
        {matches?.length > 0 ? (
          <div className="flex flex-col gap-3">
            {matches.map((m) => {
              const opp = getOpp(m);
              const won = m.winner_id === user.id;
              const badge = statusBadge[m.status] || statusBadge.pending;
              return (
                <div key={m.id} className="g-card rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        m.status === "completed" && won
                          ? "bg-accent/15 text-accent"
                          : m.status === "completed"
                          ? "bg-red-500/15 text-red-400"
                          : "bg-night-700 text-slate-300"
                      }`}>
                        {m.status === "completed" ? (won ? "W" : "L") : opp?.username?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="font-semibold text-white">
                          vs {opp?.display_name || opp?.username || "Player"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(m.created_at).toLocaleDateString()} · stake {m.stake} coins
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>
                      {badge.label}
                      {m.status === "completed" && won ? " +" + (m.stake * 2) : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="g-card w-full rounded-2xl p-8 text-center">
            <p className="text-5xl">⚔️</p>
            <h2 className="mt-3 text-lg font-bold text-white">No matches yet</h2>
            <p className="mt-1 text-sm text-slate-400">Challenge another player to start playing.</p>
          </div>
        )}
      </main>
      <BottomNav active="matches" />
    </div>
  );
}