import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/app/components/BottomNav";
import { ChatIcon } from "@/app/components/Icons";
import FeedClient from "@/app/components/FeedClient";

const PAGE_SIZE = 13;

export default async function FeedPage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params?.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Count total posts for pagination.
  const { count } = await supabase
    .from("social_posts")
    .select("id", { count: "exact", head: true });

  // Fetch a page of posts (13 per page) with author profile.
  const { data: posts } = await supabase
    .from("social_posts")
    .select("id, user_id, content, created_at, user:profiles!social_posts_user_id_fkey(username, display_name, avatar_id)")
    .order("created_at", { ascending: false })
    .range(from, to);

  // Fetch comments for those posts.
  const postIds = (posts || []).map((p) => p.id);
  let comments = [];
  if (postIds.length > 0) {
    const { data: c } = await supabase
      .from("post_comments")
      .select("id, post_id, user_id, content, created_at, user:profiles!post_comments_user_id_fkey(username, display_name, avatar_id)")
      .in("post_id", postIds)
      .order("created_at", { ascending: true });
    comments = c || [];
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <ChatIcon size={20} />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white">Feed</h1>
              <p className="text-[10px] text-slate-400">Community posts</p>
            </div>
          </div>
        </div>
      </header>

      <FeedClient currentUserId={user.id} initialPosts={posts || []} initialComments={comments} />

      {/* Pagination (13 posts/page) */}
      {count > PAGE_SIZE && (
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 px-4 pb-6">
          {page > 1 ? (
            <Link href={`/feed?page=${page - 1}`} className="flex h-10 flex-1 items-center justify-center rounded-xl border border-line bg-night-800 text-sm font-bold text-slate-300 hover:text-white">← Prev</Link>
          ) : (
            <span className="h-10 flex-1" />
          )}
          <span className="shrink-0 text-center text-xs text-slate-500">Page {page} of {Math.max(1, Math.ceil(count / PAGE_SIZE))}</span>
          {page < Math.ceil(count / PAGE_SIZE) ? (
            <Link href={`/feed?page=${page + 1}`} className="flex h-10 flex-1 items-center justify-center rounded-xl border border-line bg-night-800 text-sm font-bold text-slate-300 hover:text-white">Next →</Link>
          ) : (
            <span className="h-10 flex-1" />
          )}
        </div>
      )}

      <BottomNav active="feed" />
    </div>
  );
}