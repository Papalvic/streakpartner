import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/app/components/BottomNav";
import Avatar from "@/app/components/Avatar";
import TournamentMatchResultForm from "@/app/components/TournamentMatchResultForm";

const ROUND_NAMES = { 1: "Round 1", 2: "Semi-Final", 3: "Final", 4: "Final" };
const STATUS_META = {
  pending: { label: "Pending Match", cls: "bg-yellow-500/15 text-yellow-400" },
  completed: { label: "Completed", cls: "bg-blue-500/15 text-blue-400" },
  bye: { label: "Bye", cls: "bg-slate-500/15 text-slate-400" },
};

export default async function TournamentMatchRoomPage({ params }) {
  const { matchId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch the tournament match.
  const { data: match } = await supabase
    .from("tournament_matches")
    .select(
      `id, tournament_id, round, match_index, status, winner_id, player1_id, player2_id,
       player1_score, player2_score, is_draw,
       player1:profiles!tournament_matches_player1_id_fkey(username, display_name, avatar_id),
       player2:profiles!tournament_matches_player2_id_fkey(username, display_name, avatar_id)`
    )
    .eq("id", matchId)
    .single();

  if (!match) redirect("/tournaments");

  // Fetch the parent tournament.
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, size, entry_fee, status, winner_id, creator_id, current_players")
    .eq("id", match.tournament_id)
    .single();

  if (!tournament) redirect("/tournaments");

  const isParticipant = match.player1_id === user.id || match.player2_id === user.id;
  if (!isParticipant) redirect(`/tournaments/${match.tournament_id}`);

  const prizePool = tournament.entry_fee * tournament.size;
  const roundLabel = ROUND_NAMES[match.round] || `Round ${match.round}`;
  const status = STATUS_META[match.status] || STATUS_META.pending;

  const p1 = match.player1;
  const p2 = match.player2;
  const winnerId = match.winner_id;
  const isDraw = match.is_draw;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Link href={`/tournaments/${match.tournament_id}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-night-800 text-slate-300 hover:text-white">
              ←
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold text-white">{tournament.name}</h1>
              <p className="text-[10px] text-slate-400">{roundLabel} · Match #{match.match_index + 1}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${status.cls}`}>{status.label}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pt-4">
        {/* VS card */}
        <section className="g-card relative overflow-hidden rounded-2xl p-5 text-center">
          <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-accent/10 blur-2xl" />
          <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Link href={`/profile/${match.player1_id}`} className="flex flex-col items-center gap-2">
              <Avatar avatarId={p1?.avatar_id} size={64} className="rounded-2xl" />
              <span className="max-w-full truncate text-sm font-bold text-white">{p1?.display_name || p1?.username || "Player"}</span>
              <span className="text-[10px] text-slate-500">@{p1?.username}</span>
              {match.status === "completed" && !isDraw && winnerId === match.player1_id && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">WINNER</span>
              )}
            </Link>
            <div className="flex flex-col items-center px-1">
              <span className="text-2xl font-black text-accent">VS</span>
              {match.status === "completed" && isDraw && (
                <span className="mt-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-400">DRAW</span>
              )}
              {match.status === "completed" && !isDraw && match.player1_score !== null && (
                <span className="mt-1 text-sm font-black text-white">
                  {match.player1_score} – {match.player2_score}
                </span>
              )}
            </div>
            <Link href={`/profile/${match.player2_id}`} className="flex flex-col items-center gap-2">
              <Avatar avatarId={p2?.avatar_id} size={64} className="rounded-2xl" />
              <span className="max-w-full truncate text-sm font-bold text-white">{p2?.display_name || p2?.username || "Player"}</span>
              <span className="text-[10px] text-slate-500">@{p2?.username}</span>
              {match.status === "completed" && !isDraw && winnerId === match.player2_id && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">WINNER</span>
              )}
            </Link>
          </div>
        </section>

        {/* Tournament match info (no normal stake/pot) */}
        <section className="mt-4 g-card rounded-2xl p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-slate-400">Tournament Match</p>
          <p className="mt-1 text-sm font-semibold text-white">Entry fee already paid</p>
          <p className="mt-0.5 text-xs text-slate-400">Prize pool: <span className="font-bold text-accent">{prizePool} PromptCoin</span></p>
        </section>

        {/* Draw — replay required banner */}
        {isDraw && match.status === "pending" && (
          <section className="mt-4 g-card rounded-2xl border border-blue-500/40 p-4 text-center">
            <p className="text-sm font-bold text-blue-400">DRAW — REPLAY REQUIRED</p>
            <p className="mt-1 text-xs text-slate-300">
              Neither player advances. Replay the match and submit the new result.
            </p>
            <p className="mt-1 text-[10px] text-slate-500">No extra stake — entry fee already paid.</p>
          </section>
        )}

        {/* Result display for completed */}
        {match.status === "completed" && (
          <section className="mt-4 g-card rounded-2xl p-4 text-center">
            <p className={`text-sm font-semibold ${winnerId === user.id ? "text-accent" : "text-red-400"}`}>
              {winnerId === user.id ? "You won — advancing!" : "Opponent won — advancing."}
            </p>
          </section>
        )}

        {/* Score submission (pending tournament matches) */}
        {match.status === "pending" && match.player1_id && match.player2_id && (
          <section className="mt-4">
            <TournamentMatchResultForm match={match} currentUserId={user.id} />
          </section>
        )}

        {/* Waiting state */}
        {match.status === "pending" && (!match.player1_id || !match.player2_id) && (
          <div className="mt-4 g-card rounded-2xl p-5 text-center">
            <p className="text-3xl">🧩</p>
            <p className="mt-2 text-sm text-slate-400">Waiting for the opponent to be assigned / advance.</p>
          </div>
        )}
      </main>

      <BottomNav active="tournaments" />
    </div>
  );
}