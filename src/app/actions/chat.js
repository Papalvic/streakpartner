"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const MAX_LEN = 500;

export async function sendGeneralMessage(formData) {
  const supabase = await createClient();
  const content = String(formData.get("content") || "").trim();

  if (!content) {
    return { error: "Message cannot be empty." };
  }

  if (content.length > MAX_LEN) {
    return { error: `Message is too long (max ${MAX_LEN} characters).` };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  // RLS enforces auth.uid() = user_id. The server client sets the session
  // from the HttpOnly cookies so auth.uid() resolves correctly in production.
  const { error } = await supabase.from("general_chat_messages").insert({
    user_id: user.id,
    content,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function sendTournamentMessage(formData) {
  const supabase = await createClient();
  const content = String(formData.get("content") || "").trim();
  const tournamentId = formData.get("tournamentId");

  if (!tournamentId) {
    return { error: "Tournament ID is required." };
  }

  if (!content) {
    return { error: "Message cannot be empty." };
  }

  if (content.length > MAX_LEN) {
    return { error: `Message is too long (max ${MAX_LEN} characters).` };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  // Server client sets auth.uid() from HttpOnly cookies so the RLS
  // participant check + auth.uid() = user_id check both pass.
  const { error } = await supabase.from("tournament_chat_messages").insert({
    tournament_id: tournamentId,
    user_id: user.id,
    content,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}

export async function deleteGeneralMessage(formData) {
  const supabase = await createClient();
  const messageId = formData.get("messageId");

  if (!messageId) {
    return { error: "Message ID is required." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  // RLS will enforce that the user owns the message
  const { error } = await supabase
    .from("general_chat_messages")
    .delete()
    .eq("id", messageId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/chat");
  return { success: true };
}

export async function deleteTournamentMessage(formData) {
  const supabase = await createClient();
  const messageId = formData.get("messageId");
  const tournamentId = formData.get("tournamentId");

  if (!messageId || !tournamentId) {
    return { error: "Message and tournament ID are required." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  // RLS will enforce ownership + participant access
  const { error } = await supabase
    .from("tournament_chat_messages")
    .delete()
    .eq("id", messageId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}

export async function validateGeneralMessage(formData) {
  const supabase = await createClient();
  const content = String(formData.get("content") || "").trim();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  if (!content) {
    return { error: "Message cannot be empty." };
  }

  if (content.length > MAX_LEN) {
    return { error: `Message is too long (max ${MAX_LEN} characters).` };
  }

  return {
    success: true,
    user_id: user.id,
    content,
  };
}