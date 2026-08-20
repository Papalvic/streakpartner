"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function uploadTournamentMatchScreenshot(formData) {
  const supabase = await createClient();
  const matchId = formData.get("matchId");
  const file = formData.get("screenshot");

  if (!matchId) {
    return { error: "Match ID is required." };
  }
  if (!file || !file.size) {
    return { error: "Screenshot proof is required." };
  }

  const type = String(file.type || "");
  if (!type.startsWith("image/")) {
    return { error: "Screenshot must be an image file." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "Screenshot too large (max 5 MB)." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated." };
  }

  const { data: match, error: matchError } = await supabase
    .from("tournament_matches")
    .select("player1_id, player2_id, status")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return { error: "Tournament match not found." };
  }
  if (user.id !== match.player1_id && user.id !== match.player2_id) {
    return { error: "Only tournament match participants can submit results." };
  }
  if (match.status !== "pending") {
    return { error: "Match is not pending for submission." };
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "png";
  const safeExt = "png|jpg|jpeg|webp|gif".includes(ext) ? ext : "png";
  const path = `tournament/${matchId}/${user.id}-${Date.now()}.${safeExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("match-proofs")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("match-proofs")
    .createSignedUrl(path, 3600);

  if (signError) {
    return { error: signError.message };
  }

  return { success: true, screenshotUrl: signed.signedUrl };
}

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