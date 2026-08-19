"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const MAX_LEN = 500;

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