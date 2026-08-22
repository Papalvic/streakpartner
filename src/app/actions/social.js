"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const POST_MAX = 500;
const COMMENT_MAX = 200;
const COMMENT_CAP = 8;
const AVATAR_KEYS =
  "gamer-1,striker,keeper,cyber-1,cyber-2,cyber-3,cyber-4,cyber-5,cyber-6,cyber-7,cyber-8,cyber-9,futuristic-1,futuristic-2,futuristic-3,futuristic-4,esports-1,esports-2,esports-3,esports-4,gamer-2,gamer-3,gamer-4,badge-1,badge-2,badge-3,badge-4,badge-5,badge-6,badge-7,badge-8".split(",");

export async function saveAvatar(formData) {
  const supabase = await createClient();
  const avatarId = formData.get("avatarId");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const avatarIdStr = String(avatarId || "");
  if (!AVATAR_KEYS.includes(avatarIdStr)) {
    return { error: "Invalid avatar selected." };
  }

  // Server client sets auth.uid() so RLS update-own passes.
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_id: avatarIdStr })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { success: true };
}

export async function createPost(formData) {
  const supabase = await createClient();
  const content = String(formData.get("content") || "").trim();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!content) return { error: "Post cannot be empty." };
  if (content.length > POST_MAX) return { error: `Post too long (max ${POST_MAX}).` };

  const { data: saved, error } = await supabase
    .from("social_posts")
    .insert({ user_id: user.id, content })
    .select("id, user_id, content, created_at")
    .single();
  if (error) return { error: error.message };

  // Attach profile for the broadcast payload.
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_id")
    .eq("id", user.id)
    .single();

  const post = { ...saved, user: profile || { username: null, display_name: null, avatar_id: null } };

  await supabase.channel("feed-broadcast").send({
    type: "broadcast",
    event: "new_post",
    payload: { post },
  });

  revalidatePath("/feed");
  return { success: true, post };
}

export async function deletePost(formData) {
  const supabase = await createClient();
  const postId = formData.get("postId");
  if (!postId) return { error: "Post ID required." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: deleted, error } = await supabase
    .from("social_posts")
    .delete()
    .eq("id", postId)
    .select("id")
    .single();
  if (error) return { error: error.message };
  if (!deleted?.id) return { error: "Post not found or you can only delete your own posts." };

  await supabase.channel("feed-broadcast").send({
    type: "broadcast",
    event: "post_deleted",
    payload: { postId: deleted.id },
  });

  revalidatePath("/feed");
  return { success: true, postId: deleted.id };
}

export async function createComment(formData) {
  const supabase = await createClient();
  const postId = formData.get("postId");
  const content = String(formData.get("content") || "").trim();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!postId) return { error: "Post ID required." };
  if (!content) return { error: "Comment cannot be empty." };
  if (content.length > COMMENT_MAX) return { error: `Comment too long (max ${COMMENT_MAX}).` };

  // Enforce max 8 comments per post (server-side).
  const { count, error: countErr } = await supabase
    .from("post_comments")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  if (countErr) return { error: countErr.message };
  if (count >= COMMENT_CAP) return { error: `Maximum of ${COMMENT_CAP} comments reached on this post.` };

  const { data: saved, error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: user.id, content })
    .select("id, post_id, user_id, content, created_at")
    .single();
  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_id")
    .eq("id", user.id)
    .single();

  const comment = { ...saved, user: profile || { username: null, display_name: null, avatar_id: null } };

  await supabase.channel("feed-broadcast").send({
    type: "broadcast",
    event: "new_comment",
    payload: { comment },
  });

  revalidatePath("/feed");
  return { success: true, comment };
}

export async function deleteComment(formData) {
  const supabase = await createClient();
  const commentId = formData.get("commentId");
  const postId = formData.get("postId");
  if (!commentId || !postId) return { error: "Comment and post ID required." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: deleted, error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .select("id")
    .single();
  if (error) return { error: error.message };
  if (!deleted?.id) return { error: "Comment not found or you can only delete your own comments." };

  await supabase.channel("feed-broadcast").send({
    type: "broadcast",
    event: "comment_deleted",
    payload: { commentId: deleted.id, postId },
  });

  revalidatePath("/feed");
  return { success: true, commentId: deleted.id };
}