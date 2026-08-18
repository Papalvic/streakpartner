import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logOut } from "@/app/actions/auth";
import {
  createMatch,
  acceptMatch,
  settleMatch,
} from "@/app/actions/matches";

async function getDashboardData() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fetch all players (for challenge dropdown)
  const { data: players } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .neq("id", user.id)
    .order("username");

  // Fetch matches involving this user
  const { data: matches } = await supabase
    .from("matches")
    .select(
      `id, status, stake, settled, winner_id, created_at,
       challenger_id, opponent_id,
       challenger:profiles!matches_challenger_id_fkey(username, display_name),
       opponent:profiles!matches_opponent_id_fkey(username, display_name)`
    )
    .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  return { user, profile, players, matches };
}

export default async function Dashboard() {
  const { user, profile, players, matches } = await getDashboardData();

  const isChallenger = (match) => match.challenger_id === user.id;
  const getOpponent = (match) =>
    isChallenger(match) ? match.opponent : match.challenger;

  const pendingMatches = matches?.filter(
    (m) => m.status === "pending" && m.opponent_id === user.id
  );
  const activeMatches = matches?.filter((m) =>
    ["accepted"].includes(m.status)
  );
  const completedMatches = matches?.filter((m) => m.status === "completed");

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div>
            <h1 className="text-lg font-bold text-black dark:text-zinc-50">
              StreakPartner
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              @{profile?.username || user.email?.split("@")[0]}
            </p>
          </div>
          <form action={logOut}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Logout
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-20 pt-5">
        {/* Balance card */}
        <section className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 p-6 text-white shadow-sm dark:from-zinc-800 dark:to-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            PromptCoin Balance
          </p>
          <p className="mt-1 text-4xl font-bold">{profile?.balance ?? 0}</p>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-lg bg-white/10 py-2">
              <p className="text-sm font-bold">{profile?.matches_played ?? 0}</p>
              <p className="text-[11px] text-zinc-400">Matches</p>
            </div>
            <div className="rounded-lg bg-white/10 py-2">
              <p className="text-sm font-bold text-green-400">{profile?.wins ?? 0}</p>
              <p className="text-[11px] text-zinc-400">Wins</p>
            </div>
            <div className="rounded-lg bg-white/10 py-2">
              <p className="text-sm font-bold text-red-400">{profile?.losses ?? 0}</p>
              <p className="text-[11px] text-zinc-400">Losses</p>
            </div>
            <div className="rounded-lg bg-white/10 py-2">
              <p className="text-sm font-bold">{profile?.tournament_wins ?? 0}</p>
              <p className="text-[11px] text-zinc-400">Trophies</p>
            </div>
          </div>
        </section>

        {/* Create match */}
        <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-black dark:text-zinc-50">
            Create Match Challenge
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Costs 5 PromptCoin. Winner takes the 10 coin pot.
          </p>

          {players?.length === 0 ? (
            <p className="mt-4 rounded-lg bg-zinc-100 p-3 text-center text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              No other players yet. Ask a friend to sign up!
            </p>
          ) : (
            <form action={createMatch} className="mt-4 flex gap-2">
              <select
                name="opponentId"
                required
                defaultValue=""
                className="h-11 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="" disabled>
                  Select opponent
                </option>
                {players?.map((p) => (
                  <option key={p.id} value={p.id}>
                    @{p.username}
                    {p.display_name && p.display_name !== p.username
                      ? ` (${p.display_name})`
                      : ""}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-11 whitespace-nowrap rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
              >
                Challenge
              </button>
            </form>
          )}
        </section>

        {/* Pending incoming matches */}
        {pendingMatches?.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Incoming Challenges
            </h2>
            <div className="flex flex-col gap-3">
              {pendingMatches.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-black dark:text-zinc-50">
                        {getOpponent(m)?.display_name ||
                          getOpponent(m)?.username ||
                          "Player"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        @{getOpponent(m)?.username || "unknown"} challenged you
                        · {m.stake} coins each
                      </p>
                    </div>
                    <form action={acceptMatch}>
                      <input type="hidden" name="matchId" value={m.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        Accept
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active matches */}
        {activeMatches?.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Accepted Matches
            </h2>
            <div className="flex flex-col gap-3">
              {activeMatches.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-black dark:text-zinc-50">
                        {getOpponent(m)?.display_name ||
                          getOpponent(m)?.username ||
                          "Player"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        @{getOpponent(m)?.username || "unknown"} · pot:{" "}
                        {m.stake * 2} coins
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      In progress
                    </span>
                  </div>
                  <form
                    action={settleMatch}
                    className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800"
                  >
                    <input type="hidden" name="matchId" value={m.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-zinc-500">
                        Your score
                        <input
                          type="number"
                          name="challengerScore"
                          min="0"
                          required
                          placeholder="Your score"
                          className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                        />
                      </label>
                      <label className="text-xs text-zinc-500">
                        Opponent score
                        <input
                          type="number"
                          name="opponentScore"
                          min="0"
                          required
                          placeholder="Opponent score"
                          className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="mt-3 h-11 w-full rounded-lg bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
                    >
                      Submit Result & Claim Pot
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Completed matches */}
        {completedMatches?.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Completed Matches
            </h2>
            <div className="flex flex-col gap-2">
              {completedMatches.map((m) => {
                const won = m.winner_id === user.id;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div>
                      <p className="text-sm font-medium text-black dark:text-zinc-50">
                        vs {getOpponent(m)?.display_name || getOpponent(m)?.username || "Player"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        won
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      }`}
                    >
                      {won ? "WON" : "LOST"} · +{won ? m.stake * 2 : 0}{" "}
                      coins
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {(!matches || matches.length === 0) && (
          <div className="mt-10 text-center">
            <p className="text-4xl">⚽</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              No matches yet. Challenge another player to get started!
            </p>
          </div>
        )}
      </main>
    </div>
  );
}