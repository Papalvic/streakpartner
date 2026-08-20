"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { sendMatchMessage, deleteMatchMessage } from "@/app/actions/matches";

const MAX_LEN = 500;

export default function MatchChat({ matchId, currentUserId, initialMessages = [] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sendErr, setSendErr] = useState("");
  const bottomRef = useRef(null);

  // Realtime broadcast subscription (no browser JWT needed).
  useEffect(() => {
    const channel = supabase
      .channel(`match-chat-${matchId}`)
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const nm = payload?.message;
        if (nm?.id) {
          setMessages((prev) =>
            prev.some((m) => m.id === nm.id) ? prev : [...prev, nm]
          );
        }
      })
      .on("broadcast", { event: "message_deleted" }, ({ payload }) => {
        const { messageId } = payload || {};
        if (messageId) setMessages((prev) => prev.filter((m) => m.id !== messageId));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content) return setSendErr("Message cannot be empty.");
    if (content.length > MAX_LEN) return setSendErr("Message too long.");
    setSendErr("");
    const fd = new FormData();
    fd.set("matchId", matchId);
    fd.set("content", content);
    const result = await sendMatchMessage(fd);
    if (result?.error) return setSendErr(result.error);
    setInput("");
  };

  const del = async (id) => {
    const fd = new FormData();
    fd.set("messageId", id);
    fd.set("matchId", matchId);
    const result = await deleteMatchMessage(fd);
    if (result?.error) return setSendErr(result.error);
    setMessages((prev) => prev.filter((m) => m.id !== (result?.messageId || id)));
  };

  const fmt = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-[340px] flex-col overflow-hidden rounded-2xl border border-line bg-night-900">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-3xl">💬</p>
            <p className="mt-2 text-sm font-semibold text-white">No messages yet</p>
            <p className="mt-1 text-xs text-slate-500">Private match chat — only you and your opponent.</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === currentUserId;
            const name = m.user?.display_name || m.user?.username || "Player";
            return (
              <div key={m.id} className={`mb-2 flex w-full ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                  mine ? "border border-accent/30 bg-accent/20 rounded-br-sm" : "border border-line bg-night-800 rounded-bl-sm"
                }`}>
                  <div className={`mb-0.5 flex items-baseline gap-2 ${mine ? "justify-end" : ""}`}>
                    <Link href={`/profile/${m.user_id}`} className={`text-[10px] font-bold ${mine ? "text-accent" : "text-slate-400"} hover:underline`}>
                      {mine ? "You" : name}
                    </Link>
                    <span className="text-[9px] text-slate-500">{fmt(m.created_at)}</span>
                  </div>
                  <p className="break-words text-sm text-white">{m.content}</p>
                  {mine && (
                    <div className="mt-1 text-right">
                      <button onClick={() => del(m.id)} className="text-[9px] text-slate-500 hover:text-red-400">
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

      <div className="border-t border-line bg-night-900 p-3">
        {sendErr && <p className="mb-1 text-[11px] text-red-400">{sendErr}</p>}
        <form onSubmit={send} className="flex gap-2">
          <input type="text" value={input}
            onChange={(e) => { if (e.target.value.length <= MAX_LEN) setInput(e.target.value); }}
            placeholder="Type a message..." className="h-10 flex-1 rounded-xl border border-line bg-night-800 px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-accent" />
          <button type="submit" disabled={!input.trim()} className="h-10 rounded-lg bg-accent px-3 text-xs font-bold text-black disabled:opacity-40">Send</button>
        </form>
      </div>
    </div>
  );
}