import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/app/components/BottomNav";
import Avatar from "@/app/components/Avatar";
import { acceptMatch } from "@/app/actions/matches";
import MatchResultForm from "@/app/components/MatchResultForm";

const STATUS_META = {
  pending: { label: "Pending Challenge", cls: "bg-yellow-500/15 text-yellow-400" },
  accepted: { label: "Match Accepted", cls: "bg-accent/15 text-accent" },
  completed: { label: "Completed", cls: "bg-blue-500/15 text-blue-400" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/15 text-red-400" },
  disputed: { label: "Disputed", cls: "bg-orange-500/15 text-orange-400" },
};

export default async function MatchRoomPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch the match with full player profiles.
  const { data: match } = await supabase
    .from("matches")
    .select(
      `id, status, stake, settled, winner_id, created_at, challenger_id, opponent_id,
       challenger:profiles!matches_challenger_id_fkey(username, display_name, avatar_id),
       opponent:profiles!matches_opponent_id_fkey(username, display_name, avatar_id)`
    )
    .eq("id", id)
    .single();

  if (!match) redirect("/matches");

  // The requesting user must be a participant to see the room.
  const isParticipant = match.challenger_id === user.id || match.opponent_id === user.id;
  if (!isParticipant) {
    redirect("/matches");
  }

  // Fetch the settled result (scores) if available.
  const { data: result } = match.status === "completed"
    ? await supabase.from("match_results").select("challenger_score, opponent_score").eq("match_id", id).maybeSingle()
    : { data: null };

  // Pot values.
  const stake = match.stake ?? 5;
  const pot = stake * 2;

  const isChallenger = match.challenger_id === user.id;
  const challenger = match.challenger;
  const opponent = match.opponent;
  const status = STATUS_META[match.status] || STATUS_META.pending;
  // Awaiting the opponent means the current user is the challenger and status is still pending.
  const awaitingMyAcceptance = !isChallenger && match.status === "pending";

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Link href="/matches" className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-night-800 text-slate-300 hover:text-white">
              ←
            </Link>
            <h1 className="text-base font-extrabold text-white">Match Room</h1>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${status.cls}`}>{status.label}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pt-4">
        {/* VS card */}
        <section className="g-card relative overflow-hidden rounded-2xl p-5 text-center">
          <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-accent/10 blur-2xl" />
          <div className="pointer-events-none absolute -right-12 -bottom-12 h-40 w-40 rounded-full bg-accent/10 blur-2xl" />
          <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {/* Challenger */}
            <Link href={`/profile/${match.challenger_id}`} className="flex flex-col items-center gap-2">
              <Avatar avatarId={challenger?.avatar_id} size={72} className="rounded-2xl" />
              <span className="max-w-full truncate text-sm font-bold text-white">
                {challenger?.display_name || challenger?.username || "Player"}
              </span>
              <span className="text-[10px] text-slate-500">@{challenger?.username}</span>
            </Link>

            {/* VS */}
            <div className="flex flex-col items-center px-1">
              <span className="text-2xl font-black text-accent">VS</span>
              {match.status === "completed" && match.winner_id && (
                <span className="mt-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">WINNER →</span>
              )}
            </div>

            {/* Opponent */}
            <Link href={`/profile/${match.opponent_id}`} className="flex flex-col items-center gap-2">
              <Avatar avatarId={opponent?.avatar_id} size={72} className="rounded-2xl" />
              <span className="max-w-full truncate text-sm font-bold text-white">
                {opponent?.display_name || opponent?.username || "Player"}
              </span>
              <span className="text-[10px] text-slate-500">@{opponent?.username}</span>
            </Link>
          </div>
        </section>

        {/* Match info */}
        <section className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-line">
          <InfoCell label="Stake" value={`${stake} 🪙`} accent="text-accent" />
          <InfoCell label="Pot" value={`${pot} 🪙`} accent="text-amber-400" />
          <InfoCell label="Created" value={new Date(match.created_at).toLocaleDateString()} />
        </section>

        {/* Score display for completed matches */}
        {match.status === "completed" && result && (
          <section className="mt-4 g-card rounded-2xl p-5 text-center">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Final Score</h2>
            <div className="flex items-center justify-center gap-4">
              <span className="text-4xl font-black text-white">{result.challenger_score}</span>
              <span className="text-xl font-bold text-slate-500">–</span>
              <span className="text-4xl font-black text-white">{result.opponent_score}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-accent">
              {match.winner_id === user.id ? "You won!" : "Opponent won."} · Pot: {pot} 🪙
            </p>
          </section>
        )}

        {/* Instructions */}
        <section className="mt-4 g-card rounded-2xl p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">How to Play</h2>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-300">
            <li>Both players join a Dream League Soccer match 1v1 with your teams.</li>
            <li>Stake is 5 PromptCoin each; winner takes the 10 PromptCoin pot.</li>
            <li>Play the match and note the final score.</li>
            <li>Take a screenshot of the final score screen as proof.</li>
            <li>Submit the final score + proof. The winner is determined from the scores.</li>
          </ol>
        </section>

        {/* Pending: action area */}
        {match.status === "pending" && (
          <section className="mt-4">
            {awaitingMyAcceptance ? (
              <form action={acceptMatch} className="mt-2">
                <input type="hidden" name="matchId" value={match.id} />
                <button type="submit"
                  className="h-12 w-full rounded-xl bg-accent text-sm font-bold text-black hover:bg-accent-soft">
                  Accept Challenge · Stake 5 PromptCoin
                </button>
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  Accepting deducts 5 PromptCoin and adds it to the pot.
                </p>
              </form>
            ) : (
              <div className="g-card rounded-2xl p-4 text-center">
                <p className="text-sm text-slate-300">Waiting for opponent to accept the challenge.</p>
                <p className="mt-1 text-[11px] text-slate-500">Your 5 PromptCoin stake is locked in.</p>
              </div>
            )}
          </section>
        )}

        {/* Accepted: submit result */}
        {match.status === "accepted" && (
          <section className="mt-4">
            <MatchResultForm matchId={match.id} isChallenger={isChallenger} />
          </section>
        )}

        {/* Completed / Cancelled / Disputed: no actions */}
        {(match.status === "cancelled" || match.status === "disputed") && (
          <div className="mt-4 g-card rounded-2xl p-4 text-center text-sm text-slate-300">
            This match is {status.label.toLowerCase()}.
          </div>
        )}
      </main>

      <BottomNav active="matches" />
    </div>
  );
}

function InfoCell({ label, value, accent = "" }) {
  return (
    <div className="bg-night-800 px-3 py-3 text-center">
      <p className={`text-sm font-bold ${accent || "text-white"}`}>{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}