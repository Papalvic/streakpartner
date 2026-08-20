"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function NotificationBell({ currentUserId }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  // Securely read the authenticated user's unread notification count,
  // then poll periodically so new notifications appear without a manual refresh.
  useEffect(() => {
    let mounted = true;

    async function load() {
      if (mounted) {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", currentUserId)
          .eq("is_read", false);

        if (!error && mounted) setUnread(count || 0);
      }
    }

    load();
    const interval = setInterval(load, 10000); // refresh roughly every 10s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [currentUserId]);

  return (
    <button
      type="button"
      onClick={() => router.push("/notifications")}
      className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-night-800 text-slate-300 hover:text-white"
      aria-label="Notifications"
    >
      🔔
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-black">
          {unread}
        </span>
      )}
    </button>
  );
}