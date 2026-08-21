"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const PresenceContext = createContext({ online: new Set() });

export function usePresence() {
  return useContext(PresenceContext);
}

// Centralized online-presence via Supabase Realtime Presence.
// One shared channel; no per-avatar subscriptions, no DB writes.
export default function PresenceProvider({ children }) {
  const [online, setOnline] = useState(new Set());
  const channelRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase.channel("online-presence", {
        config: { presence: { key: user.id } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (!mounted) return;
          const state = channel.presenceState();
          const ids = new Set();
          Object.keys(state).forEach((key) => ids.add(key));
          setOnline(ids);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ user_id: user.id });
          }
        });

      channelRef.current = channel;
    }

    init();

    return () => {
      mounted = false;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  return (
    <PresenceContext.Provider value={{ online }}>
      {children}
    </PresenceContext.Provider>
  );
}