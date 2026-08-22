"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import AvatarWithPresence from "@/app/components/AvatarWithPresence";
import { supabase } from "@/lib/supabase/client";
import { createPost, deletePost, createComment, deleteComment } from "@/app/actions/social";

const POST_MAX = 500;
const COMMENT_MAX = 300;

export default function FeedClient({ currentUserId, initialPosts = [], initialComments = [] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [comments, setComments] = useState(() => {
    const m = {};
    initialPosts.forEach((p) => (m[p.id] = []));
    initialComments.forEach((c) => {
      if (!m[c.post_id]) m[c.post_id] = [];
      m[c.post_id].push(c);
    });
    return m;
  });
  const [postInput, setPostInput] = useState("");
  const [commentInput, setCommentInput] = useState({});
  const [open, setOpen] = useState({});
  const [err, setErr] = useState("");
  const topRef = useRef(null);

  // Realtime broadcast transport (no client JWT needed with HttpOnly-cookie auth).
  useEffect(() => {
    const channel = supabase
      .channel("feed-broadcast")
      .on("broadcast", { event: "new_post" }, ({ payload }) => {
        const p = payload?.post;
        if (p?.id) setPosts((prev) => (prev.some((q) => q.id === p.id) ? prev : [p, ...prev]));
      })
      .on("broadcast", { event: "post_deleted" }, ({ payload }) => {
        const { postId } = payload || {};
        if (postId) {
          setPosts((prev) => prev.filter((p) => p.id !== postId));
          setComments((prev) => { const n = { ...prev }; delete n[postId]; return n; });
        }
      })
      .on("broadcast", { event: "new_comment" }, ({ payload }) => {
        const c = payload?.comment;
        if (c?.id) setComments((prev) => {
          const list = prev[c.post_id] || [];
          return { ...prev, [c.post_id]: list.some((x) => x.id === c.id) ? list : [...list, c] };
        });
      })
      .on("broadcast", { event: "comment_deleted" }, ({ payload }) => {
        const { commentId, postId } = payload || {};
        if (commentId) setComments((prev) => ({ ...prev, [postId]: (prev[postId] || []).filter((c) => c.id !== commentId) }));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const post = async (e) => {
    e.preventDefault();
    const content = postInput.trim();
    if (!content) return setErr("Post cannot be empty.");
    if (content.length > POST_MAX) return setErr("Post too long.");
    setErr("");
    const fd = new FormData();
    fd.set("content", content);
    const r = await createPost(fd);
    if (r?.error) return setErr(r.error);
    setPostInput("");
  };

  const delPost = async (id) => {
    const fd = new FormData();
    fd.set("postId", id);
    const r = await deletePost(fd);
    if (r?.error) return setErr(r.error);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const addComment = async (e, postId) => {
    e.preventDefault();
    const content = (commentInput[postId] || "").trim();
    if (!content) return;
    if (content.length > COMMENT_MAX) return setErr("Comment too long.");
    const fd = new FormData();
    fd.set("postId", postId);
    fd.set("content", content);
    const r = await createComment(fd);
    if (r?.error) return setErr(r.error);
    setCommentInput((prev) => ({ ...prev, [postId]: "" }));
  };

  const delComment = async (commentId, postId) => {
    const fd = new FormData();
    fd.set("commentId", commentId);
    fd.set("postId", postId);
    const r = await deleteComment(fd);
    if (r?.error) return setErr(r.error);
    setComments((prev) => ({ ...prev, [postId]: (prev[postId] || []).filter((c) => c.id !== commentId) }));
  };

  const fmt = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <div ref={topRef} className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 pb-24">
      {err && <p className="mb-3 text-xs text-red-400">{err}</p>}

      <form onSubmit={post} className="g-card mb-4 rounded-2xl p-4">
        <textarea value={postInput} onChange={(e) => { if (e.target.value.length <= POST_MAX) setPostInput(e.target.value); }}
          placeholder="Share something with the community..." rows={3}
          className="h-auto w-full resize-none rounded-xl border border-line bg-night-800 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent" />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-slate-600">{postInput.length}/{POST_MAX}</span>
          <button type="submit" disabled={!postInput.trim()}
            className="flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-black hover:bg-accent-soft disabled:opacity-40">Post</button>
        </div>
      </form>

      {posts.length === 0 ? (
        <div className="g-card rounded-2xl p-8 text-center"><p className="text-4xl">📢</p><p className="mt-3 text-sm text-slate-400">No posts yet. Be the first to share!</p></div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((p) => {
            const mine = p.user_id === currentUserId;
            const cs = comments[p.id] || [];
            const isOpen = !!open[p.id];
            return (
              <div key={p.id} className="g-card rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <Link href={`/profile/${p.user_id}`}><AvatarWithPresence userId={p.user_id} avatarId={p.user?.avatar_id} size={40} className="shrink-0" /></Link>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white"><Link href={`/profile/${p.user_id}`} className="hover:text-accent">{p.user?.display_name || p.user?.username || "Player"}</Link></p>
                    <p className="text-[10px] text-slate-500">@{p.user?.username} · {fmt(p.created_at)}</p>
                  </div>
                  {mine && <button onClick={() => delPost(p.id)} className="text-[10px] text-slate-500 hover:text-red-400">Delete</button>}
                </div>
                <p className="mt-2 break-words text-sm text-white">{p.content}</p>

                <div className="mt-3 border-t border-line pt-3">
                  {cs.length > 0 && (
                    <div className="mb-2 flex flex-col gap-2">
                      {cs.map((c) => (
                        <div key={c.id} className="flex items-start gap-2">
                          <Link href={`/profile/${c.user_id}`} className="shrink-0"><AvatarWithPresence userId={c.user_id} avatarId={c.user?.avatar_id} size={24} /></Link>
                          <div className="min-w-0 flex-1 rounded-lg bg-night-800 px-2 py-1.5">
                            <p className="text-[10px] font-semibold text-accent"><Link href={`/profile/${c.user_id}`} className="hover:underline">{c.user?.display_name || c.user?.username || "Player"}</Link></p>
                            <p className="break-words text-xs text-white">{c.content}</p>
                          </div>
                          {c.user_id === currentUserId && <button onClick={() => delComment(c.id, p.id)} className="text-[10px] text-slate-500 hover:text-red-400">✕</button>}
                        </div>
                      ))}
                    </div>
                  )}

                  {isOpen && (
                    <form onSubmit={(e) => addComment(e, p.id)} className="flex gap-2">
                      <input type="text" value={commentInput[p.id] || ""}
                        onChange={(e) => { if (e.target.value.length <= COMMENT_MAX) setCommentInput((prev) => ({ ...prev, [p.id]: e.target.value })); }}
                        placeholder="Write a comment..." className="h-9 flex-1 rounded-lg border border-line bg-night-800 px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-accent" />
                      <button type="submit" disabled={!(commentInput[p.id] || "").trim()} className="h-9 rounded-lg bg-accent px-3 text-xs font-bold text-black disabled:opacity-40">Send</button>
                    </form>
                  )}

                  <button onClick={() => setOpen((prev) => ({ ...prev, [p.id]: !prev[p.id] }))} className="mt-1.5 text-[11px] font-semibold text-accent">{isOpen ? "Hide comments" : `Comment · ${cs.length}`}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}