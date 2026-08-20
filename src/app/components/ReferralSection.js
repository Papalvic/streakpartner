"use client";

import { useState } from "react";
import Link from "next/link";
import Avatar from "@/app/components/Avatar";

export default function ReferralSection({ referralCode, referralEarnings, referralHistory = [] }) {
  const [copied, setCopied] = useState(false);

  const shareMessage = `Join me on StreakPartner and get +50 PromptCoin. Use my invitation code: ${referralCode}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <section className="mt-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">INVITE & EARN</h2>
      <div className="g-card rounded-2xl p-4">
        <p className="text-[11px] text-slate-400">Your invitation code</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-night-800 px-3 py-2 text-center text-lg font-black tracking-widest text-accent">
            {referralCode || "—"}
          </code>
          <button type="button" onClick={handleCopy}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black hover:bg-accent-soft">
            {copied ? "Copied ✓" : "Copy Code"}
          </button>
        </div>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
          className="mt-2 flex h-11 w-full items-center justify-center rounded-xl bg-[#25D366] text-sm font-bold text-black hover:opacity-90">
          Share on WhatsApp
        </a>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-night-900/60 p-2">
            <p className="text-lg font-bold text-white">{referralHistory.length}</p>
            <p className="text-[9px] uppercase tracking-wide text-slate-500">Invites</p>
          </div>
          <div className="rounded-lg bg-night-900/60 p-2">
            <p className="text-lg font-bold text-accent">+{referralEarnings}</p>
            <p className="text-[9px] uppercase tracking-wide text-slate-500">Earnings</p>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-500">
          Invite a new player. You both receive +50 PromptCoin.
        </p>
      </div>

      {/* Referral history */}
      {referralHistory.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Referrals</h3>
          <div className="g-card divide-y divide-line overflow-hidden rounded-2xl">
            {referralHistory.map((r) => (
              <Link key={r.referred_user_id} href={`/profile/${r.referred_user_id}`}
                className="flex items-center gap-2 px-4 py-2.5 hover:bg-night-800">
                <Avatar avatarId={r.referred_user?.avatar_id} size={28} className="shrink-0" />
                <span className="flex-1 truncate text-sm font-semibold text-white">
                  {r.referred_user?.display_name || r.referred_user?.username || "Player"}
                  <span className="ml-1 text-[11px] text-slate-500">@{r.referred_user?.username}</span>
                </span>
                <span className="text-xs font-bold text-accent">+50</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}