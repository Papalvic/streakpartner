"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { deleteTournamentMessage } from "@/app/actions/chat";

const MAX_LEN = 500;

export default function TournamentChat({ tournamentId, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendErr, setSendErr] = useState("");
  const bottomRef = useRef(null);

  // Load current user + initial messages
  useEffect(() => {
    let mounted = true;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("tournament_chat_messages")
        .select(
          "id, user_id, content, created_at, user:profiles!tournament_chat_messages_user_id_fkey(username, display_name)"
        )
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (!error && mounted) setMessages(data || []);

      if (mounted) setLoading(false);
    }

    init();

    return () => {
      mounted = false;
    };
  }, [tournamentId]);

  // Realtime subscription
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`tournament-chat-${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tournament_chat_messages" },
        async (payload) => {
          const nm = payload.new;
          // Fetch profile if realtime payload does not include join
          if (!nm.user && nm.user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("username, display_name")
              .eq("id", nm.user_id)
              .single();
            nm.user = profile;
          }
          setMessages((prev) =>
            prev.some((m) => m.id === nm.id) ? prev : [...prev, nm]
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [tournamentId, currentUserId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content) return setSendErr("Message cannot be empty.");
    if (content.length > MAX_LEN) return setSendErr("Message too long.");
    if (!currentUserId) return setSendErr("Not authenticated.");
    setSendErr("");

    const { error } = await supabase
      .from("tournament_chat_messages")
      .insert({ tournament_id: tournamentId, user_id: currentUserId, content });

    if (error) return setSendErr(error.message);
    setInput("");
  };

  const del = async (id) => {
    const fd = new FormData();
    fd.set("messageId", id);
    await deleteTournamentMessage(fd);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const fmt = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-[400px] flex-col overflow-hidden rounded-2xl border border-line bg-night-900">
      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-500">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-3xl">🏆</p>
            <p className="mt-2 text-sm font-semibold text-white">No messages yet</p>
            <p className="mt-1 text-xs text-slate-500">Be the first to chat!</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === currentUserId;
            const name = m.user?.display_name || m.user?.username || "Player";
            return (
              <div key={m.id} className={`mb-2 flex w-full ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                  mine
                    ? "border border-accent/30 bg-accent/20 rounded-br-sm"
                    : "border border-line bg-night-800 rounded-bl-sm"
                }`}>
                  <div className={`mb-0.5 flex items-baseline gap-2 ${mine ? "justify-end" : ""}`}>
                    <span className={`text-[10px] font-bold ${mine ? "text-accent" : "text-slate-400"}`}>
                      {mine ? "You" : name}
                    </span>
                    <span className="text-[9px] text-slate-500">{fmt(m.created_at)}</span>
                  </div>
                  <p className="break-words text-sm text-white">{m.content}</p>
                  {mine && (
                    <div className="mt-1 text-right">
                      <button
                        onClick={() => del(m.id)}
                        className="text-[9px] text-slate-500 transition-colors hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-line bg-night-900 p-3">
        {sendErr && <p className="mb-1 text-[11px] text-red-400">{sendErr}</p>}
        <form onSubmit={send} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              if (e.target.value.length <= MAX_LEN) setInput(e.target.value);
            }}
            placeholder="Type a message..."
            className="h-10 flex-1 rounded-xl border border-line bg-night-800 px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-accent"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-black transition-colors hover:bg-accent-soft disabled:opacity-40"
          >
            Send
          </button>
        </form>
        <p className="mt-1 text-center text-[9px] text-slate-600">
          {input.length}/{MAX_LEN}
        </p>
      </div>
    </div>
  );
}