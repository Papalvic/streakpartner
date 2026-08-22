"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const PresenceContext = createContext({ online: new Set() });

export function usePresence() {
  return useContext(PresenceContext);
}

// Centralized online-presence via Supabase Realtime Presence.
// Uses the authenticated user id passed from the server (HttpOnly session),
// because the browser client has no session and cannot resolve it itself.
export default function PresenceProvider({ userId, children }) {
  const [online, setOnline] = useState(new Set());
  const channelRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel("online-presence", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnline(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId });
        }
      });

    channelRef.current = channel;
    return () => supabase.removeChannel(channelRef.current);
  }, [userId]);

  return (
    <PresenceContext.Provider value={{ online }}>
      {children}
    </PresenceContext.Provider>
  );
}