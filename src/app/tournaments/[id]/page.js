import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { joinTournament } from "@/app/actions/tournaments";
import BottomNav from "@/app/components/BottomNav";
import Avatar from "@/app/components/Avatar";
import { TournamentIcon, PlusIcon, CheckIcon, ChatIcon } from "@/app/components/Icons";
import TournamentChat from "@/app/components/TournamentChat";

const SIZE_LABELS = { 4: "4 Players", 8: "8 Players", 16: "16 Players", 32: "32 Players" };

const STATUS_STYLES = {
  open: { label: "Open", cls: "bg-accent/15 text-accent border-accent/20" },
  in_progress: { label: "In Progress", cls: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  completed: { label: "Completed", cls: "bg-slate-500/15 text-slate-300 border-slate-500/20" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/15 text-red-400 border-red-500/20" },
};

const ROUND_NAMES = { 1: "Round 1", 2: "Quarter Finals", 3: "Semi Finals", 4: "Final", 5: "Final" };

export default async function TournamentDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch tournament
  const { data: tournament } = await supabase
    .from("tournaments")
    .select(
      `id, name, size, entry_fee, status, current_players, winner_id, created_at,
       creator:profiles!tournaments_creator_id_fkey(username, display_name)`
    )
    .eq("id", id)
    .single();

  if (!tournament) {
    redirect("/tournaments");
  }

  // Fetch participants
  const { data: participants } = await supabase
    .from("tournament_participants")
    .select(
      `player_id, seed, joined_at,
       player:profiles!tournament_participants_player_id_fkey(username, display_name, avatar_id)`
    )
    .eq("tournament_id", id)
    .order("seed", { ascending: true });

  // Fetch bracket matches (with avatars + scores)
  const { data: bracketMatches } = await supabase
    .from("tournament_matches")
    .select(
      `id, round, match_index, status, winner_id, player1_score, player2_score, is_draw,
       player1_id, player2_id,
       player1:profiles!tournament_matches_player1_id_fkey(username, display_name, avatar_id),
       player2:profiles!tournament_matches_player2_id_fkey(username, display_name, avatar_id)`
    )
    .eq("tournament_id", id)
    .order("round", { ascending: true })
    .order("match_index", { ascending: true });

  const profile = participants?.find((p) => p.player_id === user.id);
  const isJoined = !!profile;

  // Load tournament chat messages server-side (RLS participant check passes with HttpOnly session).
  let initialTournamentMessages = [];
  if (isJoined) {
    const { data: chatMessages } = await supabase
      .from("tournament_chat_messages")
      .select(
        "id, user_id, content, created_at, user:profiles!tournament_chat_messages_user_id_fkey(username, display_name, avatar_id)"
      )
      .eq("tournament_id", id)
      .order("created_at", { ascending: true })
      .limit(200);
    initialTournamentMessages = chatMessages || [];
  }
  const pot = tournament.entry_fee * tournament.size;
  const progress = Math.round((tournament.current_players / tournament.size) * 100);
  const badge = STATUS_STYLES[tournament.status] || STATUS_STYLES.open;

  // Group matches by round
  const rounds = {};
  bracketMatches?.forEach((m) => {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  });

  const roundsList = Object.keys(rounds).sort((a, b) => Number(a) - Number(b));

  // Find the user's next match (pending round-1 or in-progress match with both players set)
  const myMatches = bracketMatches?.filter(
    (m) => m.player1_id === user.id || m.player2_id === user.id
  );
  const nextMatch = myMatches?.find((m) => m.status === "pending" && m.player1_id && m.player2_id);
  const nextOppId = nextMatch ? (nextMatch.player1_id === user.id ? nextMatch.player2_id : nextMatch.player1_id) : null;
  const nextOpp = nextMatch ? (nextOppId === nextMatch.player1_id ? nextMatch.player1 : nextMatch.player2) : null;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Link href="/tournaments" className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-night-800 text-slate-300 hover:text-white transition-colors">
              ←
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <TournamentIcon size={20} />
            </div>
            <h1 className="max-w-[200px] truncate text-base font-extrabold text-white">
              {tournament.name}
            </h1>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pt-4">
        {/* Info card */}
        <section className="g-card overflow-hidden rounded-2xl">
          <div className="border-b border-line p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold text-white">{tournament.name}</p>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              by {tournament.creator?.display_name || tournament.creator?.username || "Player"}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-px bg-line">
            <InfoCell label="Bracket" value={SIZE_LABELS[tournament.size]} />
            <InfoCell label="Entry Fee" value={`${tournament.entry_fee}🪙`} accent="text-accent" />
            <InfoCell label="Prize Pool" value={`${pot}🪙`} accent="text-amber-400" />
          </div>

          <div className="p-5">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">
                {tournament.current_players}/{tournament.size} players
              </span>
              <span className="font-semibold text-accent">{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-night-700">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            {!isJoined && tournament.status === "open" && (
              <form action={joinTournament} className="mt-4">
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <button
                  type="submit"
                  className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-bold text-black transition-colors hover:bg-accent-soft"
                >
                  <PlusIcon size={16} />
                  Join Tournament · {tournament.entry_fee} PromptCoin
                </button>
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  You need {tournament.entry_fee} PromptCoin to enter.
                </p>
              </form>
            )}

            {isJoined && (
              <div className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-accent/20 bg-accent-glow px-4 py-3">
                <CheckIcon size={14} className="text-accent" />
                <p className="text-sm font-semibold text-accent">You are in this tournament</p>
              </div>
            )}

            {tournament.status !== "open" && !isJoined && (
              <div className="mt-4 rounded-xl border border-line bg-night-800 px-4 py-3 text-center text-sm text-slate-400">
                Tournament is {badge.label.toLowerCase()} — joinings closed.
              </div>
            )}
          </div>
        </section>

        {/* YOUR TOURNAMENT — next match experience */}
        {isJoined && nextMatch && (
          <section className="mt-5 g-card relative overflow-hidden rounded-2xl p-4">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">Your Tournament</p>
            <p className="mt-1 text-sm text-slate-300">
              Next match:{" "}
              <span className="font-bold text-white">
                vs {nextOpp?.display_name || nextOpp?.username || "Player"}
              </span>
            </p>
            <Link
              href={`/tournaments/${tournament.id}/matches/${nextMatch.id}`}
              className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-bold text-black hover:bg-accent-soft"
            >
              Open Match
            </Link>
          </section>
        )}

        {/* Tournament Chat (participants only) */}
        {isJoined && (
          <section className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-widest text-slate-400">
                <ChatIcon size={14} className="text-accent" />
                Tournament Chat
              </h2>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                Participants only
              </span>
            </div>
            <TournamentChat
              tournamentId={tournament.id}
              currentUserId={user.id}
              initialMessages={initialTournamentMessages}
            />
          </section>
        )}

        {/* Participants */}
        <section className="mt-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
            Participants ({participants?.length || 0}/{tournament.size})
          </h2>
          <div className="g-card divide-y divide-line overflow-hidden rounded-2xl">
            {participants?.length > 0 ? (
              participants.map((p) => {
                const isMe = p.player_id === user.id;
                const isWinner = tournament.winner_id === p.player_id;
                return (
                  <div key={p.player_id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-night-700 text-[10px] font-bold text-slate-300">
                      #{p.seed}
                    </span>
                    <Link href={`/profile/${p.player_id}`} className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
                      <Avatar avatarId={p.player?.avatar_id} size={30} className="shrink-0 rounded-xl" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {isMe ? "You" : p.player?.display_name || p.player?.username || "Player"}
                          {isMe && <span className="ml-1.5 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">YOU</span>}
                          {isWinner && <span className="ml-1.5 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">🏆 WINNER</span>}
                        </p>
                        <p className="text-[11px] text-slate-500">@{p.player?.username}</p>
                      </div>
                    </Link>
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {new Date(p.joined_at).toLocaleDateString()}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                No participants yet.
              </div>
            )}
          </div>
        </section>

        {/* Bracket */}
        {tournament.status !== "open" && (
          <section className="mt-5 pb-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
              Bracket
            </h2>

            {roundsList.length === 0 && (
              <div className="g-card rounded-2xl p-6 text-center">
                <p className="text-3xl">🧩</p>
                <p className="mt-2 text-sm text-slate-400">Bracket will generate once the tournament fills up.</p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {roundsList.map((roundNum) => {
                const roundLabel = ROUND_NAMES[roundNum] || `Round ${roundNum}`;
                const matchesInRound = rounds[roundNum] || [];
                return (
                  <div key={roundNum}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">
                      {roundLabel}
                    </h3>
                    <div className="flex flex-col gap-2">
                      {matchesInRound.map((m) => {
                        const p1Name = m.player1?.display_name || m.player1?.username;
                        const p2Name = m.player2?.display_name || m.player2?.username;
                        const p1Won = m.winner_id === m.player1_id;
                        const p2Won = m.winner_id === m.player2_id;
                        const showScore = m.status === "completed" && m.player1_score !== null;
                        return (
                          <Link key={m.id} href={`/tournaments/${tournament.id}/matches/${m.id}`} className="g-card-press block rounded-xl p-3">
                            <div className="flex flex-col gap-1.5">
                              <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${p1Won ? "bg-accent/10 text-accent" : "bg-night-800 text-slate-300"}`}>
                                <Avatar avatarId={m.player1?.avatar_id} size={24} className="shrink-0" />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p1Name || "Waiting for player"}</span>
                                {m.status === "completed" && !m.is_draw && <span className="shrink-0 text-sm font-black">{m.player1_score ?? ""}</span>}
                                {p1Won && <span className="shrink-0 text-[10px] font-bold">WINNER</span>}
                              </div>
                              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600">
                                <span>VS</span>
                                {m.is_draw && <span className="font-bold text-blue-400">DRAW</span>}
                              </div>
                              <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${p2Won ? "bg-accent/10 text-accent" : "bg-night-800 text-slate-300"}`}>
                                <Avatar avatarId={m.player2?.avatar_id} size={24} className="shrink-0" />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p2Name || "Waiting for player"}</span>
                                {m.status === "completed" && !m.is_draw && <span className="shrink-0 text-sm font-black">{m.player2_score ?? ""}</span>}
                                {p2Won && <span className="shrink-0 text-[10px] font-bold">WINNER</span>}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <BottomNav active="tournaments" />
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