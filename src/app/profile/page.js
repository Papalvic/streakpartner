import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logOut } from "@/app/actions/auth";
import BottomNav from "@/app/components/BottomNav";
import Avatar from "@/app/components/Avatar";
import AvatarPicker from "@/app/components/AvatarPicker";
import ReferralSection from "@/app/components/ReferralSection";
import { UserIcon, CoinIcon, LogoutIcon } from "@/app/components/Icons";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const bal = profile?.balance ?? 0;
  const wins = profile?.wins ?? 0;
  const losses = profile?.losses ?? 0;
  const played = profile?.matches_played ?? 0;
  const trophies = profile?.tournament_wins ?? 0;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

  // Recent match history for this user.
  const { data: matches } = await supabase
    .from("matches")
    .select(
      `id, status, stake, winner_id, created_at, challenger_id, opponent_id,
       challenger:profiles!matches_challenger_id_fkey(username, display_name),
       opponent:profiles!matches_opponent_id_fkey(username, display_name)`
    )
    .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(5);

  const isChallenger = (m) => m.challenger_id === user.id;
  const getOpp = (m) => (isChallenger(m) ? m.opponent : m.challenger);

  // Referral data
  const referralCode = profile?.referral_code || "";
  const { data: referralTxns } = await supabase
    .from("coin_transactions")
    .select("amount")
    .eq("player_id", user.id)
    .eq("type", "referral_bonus");
  const referralEarnings = (referralTxns || []).reduce((s, t) => s + (t.amount || 0), 0);

  const { data: referralHistory } = await supabase
    .from("referrals")
    .select("referred_user_id, referred_user:profiles!referrals_referred_user_id_fkey(username, display_name, avatar_id)")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <UserIcon size={20} />
            </div>
            <h1 className="text-base font-extrabold text-white">Profile</h1>
          </div>
          <form action={logOut}>
            <button type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-line bg-night-800 px-3 py-2 text-xs font-medium text-slate-300 hover:border-line-light hover:text-white transition-colors">
              <LogoutIcon size={15} />
              Logout
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pt-4">
        {/* Identity card */}
        <section className="g-card relative overflow-hidden rounded-2xl p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-2xl" />
          <div className="flex items-center gap-4">
            <Avatar avatarId={profile?.avatar_id} size={64} className="shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold text-white">
                {profile?.display_name || profile?.username}
              </h2>
              <p className="text-xs text-slate-400">@{profile?.username}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-night-900/60 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <CoinIcon size={18} />
            </div>
            <div>
              <p className="text-lg font-black text-white">{bal.toLocaleString()}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">PromptCoin</p>
            </div>
          </div>
        </section>

        {/* Stats grid */}
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">Career Stats</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Matches Played" value={played} icon="⚽" />
            <StatCard label="Tournament Matches" value={profile?.tournament_matches_played ?? 0} icon="🛡️" accent="text-blue-400" />
            <StatCard label="Wins" value={wins} icon="✅" accent="text-accent" />
            <StatCard label="Losses" value={losses} icon="❌" accent="text-red-400" />
            <StatCard label="Win Rate" value={`${winRate}%`} icon="📊" />
            <StatCard label="Tournament Wins" value={trophies} icon="🏆" accent="text-amber-400" />
            <StatCard label="Balance" value={bal.toLocaleString()} icon="🪙" accent="text-accent" />
          </div>
        </section>

        {/* Recent match history */}
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">Recent Matches</h2>
          {matches?.length > 0 ? (
            <div className="flex flex-col gap-2">
              {matches.map((m) => {
                const opp = getOpp(m);
                const won = m.winner_id === user.id;
                return (
                  <Link key={m.id} href={`/matches/${m.id}`} className="g-card-press flex items-center justify-between rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${won ? "bg-accent/15 text-accent" : "bg-red-500/15 text-red-400"}`}>
                        {won ? "W" : "L"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">vs {opp?.display_name || opp?.username || "Player"}</p>
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

        {/* Avatar picker */}
        <section className="mt-5 pb-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">Choose Avatar</h2>
          <div className="g-card rounded-2xl p-4">
            <AvatarPicker currentAvatarId={profile?.avatar_id || "gamer-1"} />
          </div>
        </section>

        {/* INVITE & EARN */}
        <ReferralSection
          referralCode={referralCode}
          referralEarnings={referralEarnings}
          referralHistory={referralHistory || []}
        />
      </main>

      <BottomNav active="profile" />
    </div>
  );
}

function StatCard({ label, value, icon, accent = "" }) {
  return (
    <div className="g-card rounded-2xl p-4">
      <p className="text-xl">{icon}</p>
      <p className={`mt-1 text-xl font-bold ${accent || "text-white"}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{label}</p>
    </div>
  );
}