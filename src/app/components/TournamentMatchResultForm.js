"use client";

import { useState } from "react";
import { submitTournamentMatchResult } from "@/app/actions/tournaments";

export default function TournamentMatchResultForm({ match, currentUserId }) {
  const [player1Score, setPlayer1Score] = useState("");
  const [player2Score, setPlayer2Score] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // Map my score to the player slot (player1 or player2).
  const isPlayer1 = match.player1_id === currentUserId;
  const myScoreName = "player1Score";
  const theirScoreName = "player2Score";
  const myScore = isPlayer1 ? player1Score : player2Score;
  const theirScore = isPlayer1 ? player2Score : player1Score;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const fd = new FormData();
    fd.set("matchId", match.id);
    fd.set(myScoreName, String(myScore));
    fd.set(theirScoreName, String(theirScore));
    const result = await submitTournamentMatchResult(fd);
    setLoading(false);
    if (result?.error) {
      setErr(result.error);
      return;
    }
    setMsg("Result submitted! Winner determined by scores.");
  };

  return (
    <form onSubmit={handleSubmit} className="g-card rounded-2xl p-4">
      <h3 className="mb-3 text-base font-bold text-white">Submit Match Result</h3>
      {match.is_draw ? (
        <div className="mb-3 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2">
          <p className="text-xs font-bold text-blue-400">DRAW — REPLAY REQUIRED</p>
          <p className="mt-0.5 text-[11px] text-slate-300">
            Neither player advances. Replay the match and submit the new result.
          </p>
        </div>
      ) : (
        <p className="mb-3 text-xs text-slate-400">
          Enter the final scores. A WIN advances the winner. A DRAW requires a replay — nobody advances.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Your score</span>
          <input type="number" min="0" step="1" required value={myScore}
            onChange={(e) => isPlayer1 ? setPlayer1Score(e.target.value) : setPlayer2Score(e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-night-800 px-3 text-center text-2xl font-black text-white outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Opponent score</span>
          <input type="number" min="0" step="1" required value={theirScore}
            onChange={(e) => isPlayer1 ? setPlayer2Score(e.target.value) : setPlayer1Score(e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-night-800 px-3 text-center text-2xl font-black text-white outline-none focus:border-accent" />
        </label>
      </div>

      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      {msg && <p className="mt-2 text-xs text-accent">{msg}</p>}

      <button type="submit" disabled={loading}
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-bold text-black hover:bg-accent-soft disabled:opacity-40">
        {loading ? "Submitting..." : "Submit Result"}
      </button>
      <div className="mt-2 space-y-1 text-center text-[10px] text-slate-500">
        <p>WIN → advances to the next round</p>
        <p>DRAW → requires resolution, nobody advances</p>
        <p>Entry fee already paid — no extra stake.</p>
      </div>
    </form>
  );
}