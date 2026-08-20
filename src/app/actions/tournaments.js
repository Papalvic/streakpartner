"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function submitTournamentMatchResult(formData) {
  const supabase = await createClient();
  const matchId = formData.get("matchId");
  const player1Score = Number(formData.get("player1Score"));
  const player2Score = Number(formData.get("player2Score"));
  const screenshotUrl = formData.get("screenshotUrl") || null;

  if (!matchId) {
    return { error: "Match ID is required." };
  }

  // Scores must be integers >= 0. Draw is allowed (handled by the RPC).
  if (
    !Number.isInteger(player1Score) ||
    !Number.isInteger(player2Score) ||
    player1Score < 0 ||
    player2Score < 0
  ) {
    return { error: "Scores must be whole numbers 0 or greater." };
  }

  const { error } = await supabase.rpc("submit_tournament_match_result", {
    p_match_id: matchId,
    p_player1_score: player1Score,
    p_player2_score: player2Score,
    p_screenshot_url: screenshotUrl,
  });

  if (error) {
    return { error: error.message };
  }

  // Fetch the match to know which tournament to revalidate.
  const { data: match } = await supabase
    .from("tournament_matches")
    .select("tournament_id")
    .eq("id", matchId)
    .single();

  if (match?.tournament_id) {
    revalidatePath(`/tournaments/${match.tournament_id}`);
  }
  return { success: true };
}

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