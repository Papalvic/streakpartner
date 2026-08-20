"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // RLS enforces only the authenticated user's own notifications.
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) return { error: error.message };

  revalidatePath("/notifications");
  return { success: true };
}

export async function markNotificationRead(formData) {
  const supabase = await createClient();
  const id = formData.get("id");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  if (!id) return { error: "Notification ID required." };

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/notifications");
  return { success: true };
}