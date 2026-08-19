import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/app/components/BottomNav";
import { ChatIcon } from "@/app/components/Icons";
import FeedClient from "@/app/components/FeedClient";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch posts with author profile (server-side so RLS reads pass with HttpOnly session).
  const { data: posts } = await supabase
    .from("social_posts")
    .select("id, user_id, content, created_at, user:profiles!social_posts_user_id_fkey(username, display_name, avatar_id)")
    .order("created_at", { ascending: false })
    .limit(50);

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

      <BottomNav active="feed" />
    </div>
  );
}