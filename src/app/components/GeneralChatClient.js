"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import AvatarWithPresence from "@/app/components/AvatarWithPresence";
import { supabase } from "@/lib/supabase/client";
import { deleteGeneralMessage, sendGeneralMessage } from "@/app/actions/chat";

const MAX_LEN = 500;

export default function GeneralChatClient({ currentUserId, initialMessages = [] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [sendErr, setSendErr] = useState("");
  const bottomRef = useRef(null);

  // Realtime subscription (broadcast from the server action — no browser JWT needed,
  // works with the HttpOnly-cookie auth architecture).
  useEffect(() => {
    const channel = supabase
      .channel("general-chat-broadcast")
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
        if (messageId) {
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Scroll bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content) return setSendErr("Message cannot be empty.");
    if (content.length > MAX_LEN) return setSendErr("Message too long.");
    setSendErr("");

    // Route through the server so auth.uid() resolves from HttpOnly cookies (RLS passes).
    const fd = new FormData();
    fd.set("content", content);
    const result = await sendGeneralMessage(fd);
    if (result?.error) return setSendErr(result.error);
    setInput("");
  };

  const del = async (id) => {
    const fd = new FormData();
    fd.set("messageId", id);
    const result = await deleteGeneralMessage(fd);
    if (result?.error) return setSendErr(result.error);
    // Remove immediately; the message_deleted broadcast also covers other viewers.
    const deletedId = result?.messageId || id;
    setMessages((prev) => prev.filter((m) => m.id !== deletedId));
  };

  const fmt = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {/* Messages */}
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex flex-1 items-center justify-center"><p className="text-sm text-slate-500">Loading messages...</p></div>
        ) : err ? (
          <div className="flex flex-1 items-center justify-center"><p className="text-sm text-red-400">{err}</p></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-4xl">💬</p>
            <p className="mt-3 text-sm font-semibold text-white">No messages yet</p>
            <p className="mt-1 text-xs text-slate-500">Say hi to the community!</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === currentUserId;
            const displayName = m.user?.display_name || m.user?.username || "Player";
            return (
              <div key={m.id} className={`flex w-full mb-3 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && (
                  <Link href={`/profile/${m.user_id}`} className="mr-2 shrink-0 self-end">
                    <AvatarWithPresence userId={m.user_id} avatarId={m.user?.avatar_id} size={30} className="rounded-xl" />
                  </Link>
                )}
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? "bg-accent/20 border border-accent/30 rounded-br-sm text-right" : "bg-night-800 border border-line rounded-bl-sm"}`}>
                  <div className={`mb-0.5 flex flex-wrap items-baseline gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                    <Link href={`/profile/${m.user_id}`} className="inline-flex items-center gap-1 hover:underline">
                      <span className={`text-[11px] font-bold ${mine ? "text-accent" : "text-white"}`}>{mine ? "You" : displayName}</span>
                      {!mine && <span className="text-[9px] text-slate-500">@{m.user?.username}</span>}
                    </Link>
                    <span className="text-[9px] text-slate-500">{fmt(m.created_at)}</span>
                  </div>
                  <p className="break-words text-sm text-white">{m.content}</p>
                  {mine && (
                    <div className="mt-1 text-right">
                      <button onClick={() => del(m.id)} className="text-[9px] text-slate-500 hover:text-red-400 transition-colors">Delete</button>
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
      <div className="border-t border-line bg-night/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-lg px-3 py-2">
          {sendErr && <p className="mb-1 text-[11px] text-red-400">{sendErr}</p>}
          <form onSubmit={send} className="flex gap-2">
            <input type="text" value={input}
              onChange={(e) => { if (e.target.value.length <= MAX_LEN) setInput(e.target.value); }}
              placeholder="Type a message..."
              className="h-11 flex-1 rounded-xl border border-line bg-night-800 px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-accent" />
            <button type="submit" disabled={!input.trim()}
              className="flex h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-black transition-colors hover:bg-accent-soft disabled:opacity-40">Send</button>
          </form>
          <p className="mt-1 text-center text-[9px] text-slate-600">{input.length}/{MAX_LEN}</p>
        </div>
      </div>
    </>
  );
}
