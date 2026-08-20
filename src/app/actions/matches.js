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
  const pageChallengerScore = Number(formData.get("challengerScore"));
  const pageOpponentScore = Number(formData.get("opponentScore"));
  const screenshotUrl = formData.get("screenshotUrl");

  if (!matchId) {
    return { error: "Match ID is required." };
  }

  // Scores must be integers >= 0.
  if (
    !Number.isInteger(pageChallengerScore) ||
    !Number.isInteger(pageOpponentScore) ||
    pageChallengerScore < 0 ||
    pageOpponentScore < 0
  ) {
    return { error: "Scores must be whole numbers 0 or greater." };
  }

  // Screenshot proof is required.
  if (!screenshotUrl || screenshotUrl === "manual") {
    return { error: "Screenshot proof is required to submit a result." };
  }

  // IMPORTANT: Fetch the match to correctly map scores to challenger/opponent
  // and derive the winner from scores, never trusting a client-supplied winnerId.
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("challenger_id, opponent_id")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return { error: "Match not found." };
  }

  // Determine whether the submitting user is the challenger or opponent,
  // then map the submitted scores accordingly.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  let challengerScore;
  let opponentScore;
  let winnerId;

  if (user.id === match.challenger_id) {
    challengerScore = pageChallengerScore;
    opponentScore = pageOpponentScore;
    winnerId =
      challengerScore > opponentScore ? user.id : match.opponent_id;
    if (challengerScore === opponentScore) {
      return { error: "Scores cannot be tied." };
    }
  } else if (user.id === match.opponent_id) {
    challengerScore = pageOpponentScore;
    opponentScore = pageChallengerScore;
    winnerId =
      pageOpponentScore > pageChallengerScore ? user.id : match.challenger_id;
    if (pageOpponentScore === pageChallengerScore) {
      return { error: "Scores cannot be tied." };
    }
  } else {
    return { error: "Only match participants can submit results." };
  }

  const { error } = await supabase.rpc("settle_match", {
    p_match_id: matchId,
    p_winner_id: winnerId,
    p_challenger_score: challengerScore,
    p_opponent_score: opponentScore,
    p_screenshot_url: screenshotUrl,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
