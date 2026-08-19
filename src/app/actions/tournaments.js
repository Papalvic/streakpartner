"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTournament(formData) {
  const supabase = await createClient();
  const name = formData.get("name");
  const size = Number(formData.get("size"));
  const entryFee = Number(formData.get("entryFee") || 5);

  if (!name || !name.trim()) {
    return { error: "Give your tournament a name." };
  }

  if (![4, 8, 16, 32].includes(size)) {
    return { error: "Size must be 4, 8, 16 or 32." };
  }

  if (isNaN(entryFee) || entryFee <= 0) {
    return { error: "Entry fee must be a positive number." };
  }

  const { data, error } = await supabase.rpc("create_tournament", {
    p_name: name.trim(),
    p_size: size,
    p_entry_fee: entryFee,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/tournaments");
  redirect(`/tournaments/${data}`);
}

export async function joinTournament(formData) {
  const supabase = await createClient();
  const tournamentId = formData.get("tournamentId");

  if (!tournamentId) {
    return { error: "Tournament ID is required." };
  }

  const { error } = await supabase.rpc("join_tournament", {
    p_tournament_id: tournamentId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}