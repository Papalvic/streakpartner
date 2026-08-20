import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/app/components/BottomNav";
import Avatar from "@/app/components/Avatar";
import { SwordsIcon } from "@/app/components/Icons";
import JoinByCode from "@/app/components/JoinByCode";

const STATUS_META = {
  pending: { label: "Pending", cls: "bg-yellow-500/15 text-yellow-400" },
  accepted: { label: "In Progress", cls: "bg-accent/15 text-accent" },
  completed: { label: "Completed", cls: "bg-blue-500/15 text-blue-400" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/15 text-red-400" },
  disputed: { label: "Disputed", cls: "bg-orange-500/15 text-orange-400" },
};

export default async function MatchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: matches } = await supabase
    .from("matches")
    .select(
      `id, status, stake, settled, winner_id, created_at, challenger_id, opponent_id,
       challenger:profiles!matches_challenger_id_fkey(username, display_name, avatar_id),
       opponent:profiles!matches_opponent_id_fkey(username, display_name, avatar_id)`
    )
    .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch scores for completed matches.
  const completedIds = (matches || []).filter((m) => m.status === "completed").map((m) => m.id);
  const scores = {};
  if (completedIds.length > 0) {
    const { data: results } = await supabase
      .from("match_results")
      .select("match_id, challenger_score, opponent_score")
      .in("match_id", completedIds);
    (results || []).forEach((r) => (scores[r.match_id] = r));
  }

  const isChallenger = (m) => m.challenger_id === user.id;
  const getOpp = (m) => (isChallenger(m) ? m.opponent : m.challenger);

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
        {/* Join challenge by code */}
        <div className="mb-4">
          <JoinByCode />
        </div>

        {matches?.length > 0 ? (
          <div className="flex flex-col gap-3">
            {matches.map((m) => {
              const opp = getOpp(m);
              const won = m.winner_id === user.id;
              const meta = STATUS_META[m.status] || STATUS_META.pending;
              const score = scores[m.id];
              const myScore = isChallenger(m) ? score?.challenger_score : score?.opponent_score;
              const oppScore = isChallenger(m) ? score?.opponent_score : score?.challenger_score;
              return (
                <Link key={m.id} href={`/matches/${m.id}`} className="g-card-press block rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar avatarId={opp?.avatar_id} size={40} className="shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          vs {opp?.display_name || opp?.username || "Player"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(m.created_at).toLocaleDateString()} · stake {m.stake} coins
                        </p>
                        {/* Show score for completed matches */}
                        {m.status === "completed" && score && (
                          <p className="mt-0.5 text-sm font-black text-white">
                            {myScore} – {oppScore}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.cls}`}>
                        {meta.label}
                      </span>
                      {m.status === "completed" && (
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${won ? "bg-accent/15 text-accent" : "bg-red-500/15 text-red-400"}`}>
                          {won ? `WON +${m.stake * 2}` : `LOST -${m.stake}`}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
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