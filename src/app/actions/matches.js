"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  const screenshotUrl = formData.get("screenshotUrl") || "manual";

  if (!matchId) {
    return { error: "Match ID is required." };
  }

  if (
    isNaN(pageChallengerScore) ||
    isNaN(pageOpponentScore) ||
    pageChallengerScore < 0 ||
    pageOpponentScore < 0
  ) {
    return { error: "Scores must be valid non-negative numbers." };
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
