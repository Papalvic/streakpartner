"use server";

import { createClient } from "@/lib/supabase/server";

export async function searchPlayers(formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const query = String(formData.get("query") || "").trim();
  if (!query || query.length < 2) return { success: true, players: [] };

  const term = `%${query}%`;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_id")
    .or(`username.ilike.${term},display_name.ilike.${term}`)
    .neq("id", user.id)
    .limit(10);

  if (error) return { error: error.message };
  return { success: true, players: data || [] };
}