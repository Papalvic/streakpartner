import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createTournament, joinTournament } from "@/app/actions/tournaments";
import BottomNav from "@/app/components/BottomNav";
import { TournamentIcon, PlusIcon, CoinIcon, CheckIcon } from "@/app/components/Icons";

const SIZE_LABELS = { 4: "4 Players", 8: "8 Players", 16: "16 Players", 32: "32 Players" };

const STATUS_STYLES = {
  open: { label: "Open", cls: "bg-accent/15 text-accent border-accent/20" },
  in_progress: { label: "In Progress", cls: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  completed: { label: "Completed", cls: "bg-slate-500/15 text-slate-300 border-slate-500/20" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/15 text-red-400 border-red-500/20" },
};

export default async function TournamentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch user profile (balance for displaying)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, balance")
    .eq("id", user.id)
    .single();

  // Fetch all tournaments with creator + winner info
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select(
      `id, name, size, entry_fee, status, current_players, winner_id, created_at,
       creator:profiles!tournaments_creator_id_fkey(username, display_name),
       winner:profiles!tournaments_winner_id_fkey(username, display_name)`
    )
    .order("created_at", { ascending: false });

  // Fetch which tournaments this user has joined
  const { data: joined } = await supabase
    .from("tournament_participants")
    .select("tournament_id")
    .eq("player_id", user.id);

  const joinedIds = new Set(joined?.map((j) => j.tournament_id) || []);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <TournamentIcon size={20} />
            </div>
            <h1 className="text-base font-extrabold text-white">Tournaments</h1>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-night-800 px-2.5 py-1.5 text-xs font-semibold text-accent">
            <CoinIcon size={14} />
            {profile?.balance ?? 0}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pt-4">
        {/* Balance reminder */}
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-accent/20 bg-accent-glow px-4 py-3">
          <CoinIcon size={16} className="text-accent" />
          <p className="text-xs text-slate-300">
            Balance: <span className="font-bold text-accent">{profile?.balance ?? 0} PromptCoin</span> · Joining deducts the entry fee
          </p>
        </div>

        {/* Create Tournament */}
        <section className="g-card mb-5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <PlusIcon size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create Tournament</h2>
              <p className="text-[11px] text-slate-400">Make a bracket · you are player #1</p>
            </div>
          </div>
          <form action={createTournament} className="mt-3 flex flex-col gap-3">
            <input
              type="text"
              name="name"
              required
              maxLength={40}
              placeholder="Tournament name (e.g. Friday DLS Cup)"
              className="h-11 w-full rounded-xl border border-line bg-night-800 px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-accent"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                name="size"
                required
                defaultValue="4"
                className="h-11 rounded-xl border border-line bg-night-800 px-3 text-sm text-white outline-none transition-colors focus:border-accent"
              >
                <option value="4">4 Players</option>
                <option value="8">8 Players</option>
                <option value="16">16 Players</option>
                <option value="32">32 Players</option>
              </select>
              <select
                name="entryFee"
                required
                defaultValue="5"
                className="h-11 rounded-xl border border-line bg-night-800 px-3 text-sm text-white outline-none transition-colors focus:border-accent"
              >
                <option value="5">5 PromptCoin</option>
                <option value="10">10 PromptCoin</option>
                <option value="20">20 PromptCoin</option>
              </select>
            </div>
            <button
              type="submit"
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-bold text-black transition-colors hover:bg-accent-soft"
            >
              <PlusIcon size={16} />
              Create Tournament
            </button>
          </form>
        </section>

        {/* Tournament list */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
            All Tournaments
          </h2>

          {tournaments?.length === 0 && (
            <div className="g-card rounded-2xl p-8 text-center">
              <p className="text-4xl">🏆</p>
              <p className="mt-3 text-sm text-slate-400">
                No tournaments yet. Create the first one!
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {tournaments?.map((t) => {
              const badge = STATUS_STYLES[t.status] || STATUS_STYLES.open;
              const isJoined = joinedIds.has(t.id);
              const isCreator = t.creator_id === user.id;
              const progress = Math.round((t.current_players / t.size) * 100);
              const pot = t.entry_fee * t.size;

              return (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.id}`}
                  className="g-card-press block rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">{t.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        by {t.creator?.display_name || t.creator?.username || "Player"}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-night-900/60 px-2 py-2 text-center">
                      <p className="text-sm font-bold text-white">{SIZE_LABELS[t.size]}</p>
                      <p className="text-[9px] uppercase tracking-wide text-slate-500">Bracket</p>
                    </div>
                    <div className="rounded-lg bg-night-900/60 px-2 py-2 text-center">
                      <p className="text-sm font-bold text-accent">{t.entry_fee}🪙</p>
                      <p className="text-[9px] uppercase tracking-wide text-slate-500">Entry</p>
                    </div>
                    <div className="rounded-lg bg-night-900/60 px-2 py-2 text-center">
                      <p className="text-sm font-bold text-amber-400">{pot}🪙</p>
                      <p className="text-[9px] uppercase tracking-wide text-slate-500">Prize Pool</p>
                    </div>
                  </div>

                  {/* Completed winner */}
                  {t.status === "completed" && t.winner && (
                    <p className="mt-2 text-xs font-semibold text-accent">
                      Winner: @{t.winner.display_name || t.winner.username}
                    </p>
                  )}

                  {/* Players progress */}
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        {t.current_players}/{t.size} players
                      </span>
                      <span className="font-semibold text-accent">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-night-700">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                    {isCreator && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                        YOU CREATED
                      </span>
                    )}
                    {isJoined && !isCreator && (
                      <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                        <CheckIcon size={10} /> JOINED
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      <BottomNav active="tournaments" />
    </div>
  );
}