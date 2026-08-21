"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function uploadMatchScreenshot(formData) {
  const supabase = await createClient();
  const matchId = formData.get("matchId");
  const file = formData.get("screenshot");

  if (!matchId) {
    return { error: "Match ID is required." };
  }

  if (!file || !file.size) {
    return { error: "Screenshot proof is required." };
  }

  // Only allow image files.
  const type = String(file.type || "");
  if (!type.startsWith("image/")) {
    return { error: "Screenshot must be an image file." };
  }

  // 5 MB max.
  if (file.size > 5 * 1024 * 1024) {
    return { error: "Screenshot too large (max 5 MB)." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  // Verify the user is a participant of this match and the match is accepted.
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("challenger_id, opponent_id, status")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return { error: "Match not found." };
  }

  if (user.id !== match.challenger_id && user.id !== match.opponent_id) {
    return { error: "Only match participants can submit results." };
  }

  if (match.status !== "accepted") {
    return { error: "Match must be accepted before submitting a result." };
  }

  // Upload to the existing secure match-proofs bucket (server-side, not public-writable).
  const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "png";
  const safeExt = "png|jpg|jpeg|webp|gif".includes(ext) ? ext : "png";
  const path = `${matchId}/${user.id}-${Date.now()}.${safeExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("match-proofs")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: uploadError.message };
  }

  // Return a signed URL (expires in 1 hour) for immediate use/display.
  const { data: signed, error: signError } = await supabase.storage
    .from("match-proofs")
    .createSignedUrl(path, 3600);

  if (signError) {
    return { error: signError.message };
  }

  return { success: true, screenshotUrl: signed.signedUrl, storagePath: path };
}

export async function createMatch(formData) {
  const supabase = await createClient();
  const opponentId = formData.get("opponentId");

  if (!opponentId) {
    return { error: "Select an opponent." };
  }

  const { data, error } = await supabase.rpc("create_match", {
    p_opponent_id: opponentId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true, matchId: data };
}

export async function rejectMatch(formData) {
  const supabase = await createClient();
  const matchId = formData.get("matchId");
  if (!matchId) return { error: "Match ID is required." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Secure RPC: locks match, verifies pending + opponent-only, atomic refund to challenger,
  // records match_refund, cancels match, notifies challenger.
  const { error } = await supabase.rpc("reject_match", { p_match_id: matchId });
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/matches");
  return { success: true };
}

export async function acceptMatch(formData) {
  const supabase = await createClient();
  const matchId = formData.get("matchId");

  if (!matchId) {
    return { error: "Match ID is required." };
  }

  const { error } = await supabase.rpc("accept_match", {
    p_match_id: matchId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function settleMatch(formData) {
  const supabase = await createClient();
  const matchId = formData.get("matchId");
  // Explicit challener/opponent scores — the client never swaps roles.
  const challengerScore = Number(formData.get("challengerScore"));
  const opponentScore = Number(formData.get("opponentScore"));
  const screenshotUrl = formData.get("screenshotUrl") || null;

  if (!matchId) {
    return { error: "Match ID is required." };
  }

  // Scores must be integers >= 0. Draws are now valid.
  if (
    !Number.isInteger(challengerScore) ||
    !Number.isInteger(opponentScore) ||
    challengerScore < 0 ||
    opponentScore < 0
  ) {
    return { error: "Scores must be whole numbers 0 or greater." };
  }

  // IMPORTANT: Verify the submitting user is one of the two participants.
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("challenger_id, opponent_id, status, settled")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return { error: "Match not found." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  // Either challenger or opponent may submit, but it must be a participant.
  if (user.id !== match.challenger_id && user.id !== match.opponent_id) {
    return { error: "Only match participants can submit results." };
  }

  // The RPC enforces accepted status + not settled + derives the winner.
  const { error } = await supabase.rpc("settle_match", {
    p_match_id: matchId,
    p_challenger_score: challengerScore,
    p_opponent_score: opponentScore,
    p_screenshot_url: screenshotUrl,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath(`/matches/${matchId}`);
  return { success: true };
}

export async function findMatchByCode(formData) {
  const supabase = await createClient();
  const code = String(formData.get("code") || "").trim();

  if (!code) {
    return { error: "Enter a challenge code." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  // Server checks: pending, not own challenge. Returns match id.
  const { data, error } = await supabase.rpc("find_match_by_code", {
    p_code: code,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true, matchId: data };
}

export async function sendMatchMessage(formData) {
  const supabase = await createClient();
  const matchId = formData.get("matchId");
  const content = String(formData.get("content") || "").trim();

  if (!matchId) {
    return { error: "Match ID is required." };
  }
  if (!content) {
    return { error: "Message cannot be empty." };
  }
  if (content.length > 500) {
    return { error: "Message too long (max 500 characters)." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  // RLS enforces participant membership + auth.uid() = user_id.
  const { data: saved, error: insertError } = await supabase
    .from("match_chat_messages")
    .insert({ match_id: matchId, user_id: user.id, content })
    .select("id, match_id, user_id, content, created_at")
    .single();

  if (insertError) {
    return { error: insertError.message };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_id")
    .eq("id", user.id)
    .single();

  const message = {
    ...saved,
    user: profile || { username: null, display_name: null, avatar_id: null },
  };

  // Broadcast on match-specific channel (no browser JWT needed).
  await supabase.channel(`match-chat-${matchId}`).send({
    type: "broadcast",
    event: "new_message",
    payload: { message },
  });

  return { success: true, message };
}

export async function deleteMatchMessage(formData) {
  const supabase = await createClient();
  const messageId = formData.get("messageId");
  const matchId = formData.get("matchId");

  if (!messageId || !matchId) {
    return { error: "Message and match ID are required." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  // RLS enforces ownership + participant access.
  const { data: deleted, error } = await supabase
    .from("match_chat_messages")
    .delete()
    .eq("id", messageId)
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  if (!deleted?.id) {
    return { error: "Message not found or you can only delete your own messages." };
  }

  await supabase.channel(`match-chat-${matchId}`).send({
    type: "broadcast",
    event: "message_deleted",
    payload: { messageId: deleted.id },
  });

  revalidatePath(`/matches/${matchId}`);
  return { success: true, messageId: deleted.id };
}
