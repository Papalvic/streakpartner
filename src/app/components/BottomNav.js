"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import {
  HomeIcon,
  SwordsIcon,
  TrophyIcon,
  LeaderboardIcon,
  UserIcon,
} from "./Icons";

// Notifications (bell) icon — same stroke style/size as the others.
function BellIcon({ size = 21, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// Feed icon (megaphone-style)
function FeedIcon({ size = 21, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

const navItems = [
  { name: "Home", href: "/", icon: HomeIcon },
  { name: "Feed", href: "/feed", icon: FeedIcon },
  { name: "Matches", href: "/matches", icon: SwordsIcon },
  { name: "Tournaments", href: "/tournaments", icon: TrophyIcon },
  { name: "Notif", href: "/notifications", icon: BellIcon },
  { name: "Profile", href: "/profile", icon: UserIcon },
];

export default function BottomNav({ active = "home" }) {
  const [unread, setUnread] = useState(0);

  // Securely read the authenticated user's unread notification count, then poll
  // so the badge updates without a full page refresh (RLS-enforced).
  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (!error && mounted) setUnread(count || 0);
    }
    load();
    const interval = setInterval(load, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-night-900/95 backdrop-blur-md">
      <div className="mx-auto grid w-full max-w-lg grid-cols-6 items-center px-1 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const isActive = active === item.name.toLowerCase();
          const Icon = item.icon;
          const showBadge = item.name === "Notif" && unread > 0;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? "text-accent" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className={`relative ${isActive ? "text-accent" : ""}`}>
                <Icon size={21} />
                {showBadge && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[8px] font-bold leading-none text-black">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
                {isActive && (
                  <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />
                )}
              </span>
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
