"use client";

import { useState } from "react";
import Avatar from "@/app/components/Avatar";
import { uploadTournamentMatchScreenshot, submitTournamentMatchResult } from "@/app/actions/tournaments";

export default function TournamentMatchResultForm({ match, currentUserId }) {
  const [player1Score, setPlayer1Score] = useState("");
  const [player2Score, setPlayer2Score] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const p1 = match.player1;
  const p2 = match.player2;

  const p1Name = p1?.display_name || p1?.username || "Player 1";
  const p2Name = p2?.display_name || p2?.username || "Player 2";

  const isDrawPreview =
    player1Score !== "" && player2Score !== "" && Number(player1Score) === Number(player2Score);
  const hasBothScores = player1Score !== "" && player2Score !== "";

  const handleScreenshot = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setUploading(true);
    const fd = new FormData();
    fd.set("matchId", match.id);
    fd.set("screenshot", file);
    const result = await uploadTournamentMatchScreenshot(fd);
    setUploading(false);
    if (result?.error) {
      setErr(result.error);
      return;
    }
    setScreenshotUrl(result.screenshotUrl);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const fd = new FormData();
    fd.set("matchId", match.id);
    // Always bind exactly to player1/player2 — never to the logged-in user.
    fd.set("player1Score", String(player1Score));
    fd.set("player2Score", String(player2Score));
    if (screenshotUrl) fd.set("screenshotUrl", screenshotUrl);
    const result = await submitTournamentMatchResult(fd);
    setLoading(false);
    if (result?.error) {
      setErr(result.error);
      return;
    }
    setMsg("Result submitted! Winner determined by scores.");
  };

  // Score input for a specific player slot
  const PlayerScoreInput = ({ player, score, setScore, slotLabel }) => {
    const name = player?.display_name || player?.username || slotLabel;
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-line bg-night-900/60 p-3 text-center">
        <Avatar avatarId={player?.avatar_id} size={44} className="shrink-0 rounded-xl" />
        <p className="w-full truncate text-sm font-bold text-white">{name}</p>
        <p className="w-full truncate text-[11px] text-slate-500">@{player?.username}</p>
        <span className="mt-1 w-full text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">
          Score
        </span>
        <input
          type="number"
          min="0"
          step="1"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="0"
          className="h-12 w-20 rounded-xl border border-line bg-night-800 text-center text-2xl font-black text-white outline-none focus:border-accent"
        />
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="g-card rounded-2xl p-4">
      <h3 className="mb-1 text-base font-bold text-white">SUBMIT MATCH RESULT</h3>
      <p className="mb-3 text-xs text-slate-400">Enter the final score exactly as played.</p>

      {match.is_draw && (
        <div className="mb-3 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2">
          <p className="text-xs font-bold text-blue-400">DRAW — REPLAY REQUIRED</p>
          <p className="mt-0.5 text-[11px] text-slate-300">
            Neither player advances. Replay the match and submit the new result.
          </p>
        </div>
      )}

      {/* Two player score cards — identities bound to actual player slots */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <PlayerScoreInput player={p1} score={player1Score} setScore={setPlayer1Score} slotLabel="Player 1" />
        <PlayerScoreInput player={p2} score={player2Score} setScore={setPlayer2Score} slotLabel="Player 2" />
      </div>

      {/* Result preview */}
      {hasBothScores && (
        <div className="mb-3 rounded-xl border border-line bg-night-900/60 p-3 text-center">
          <p className="text-sm font-black text-white">
            {p1Name} <span className="text-slate-500"> {player1Score} — {player2Score} </span> {p2Name}
          </p>
          {isDrawPreview ? (
            <p className="mt-1 text-xs font-bold text-blue-400">DRAW — REPLAY REQUIRED</p>
          ) : Number(player1Score) > Number(player2Score) ? (
            <p className="mt-1 text-xs font-semibold text-accent">
              {p1Name} wins — advances to the next round.
            </p>
          ) : Number(player2Score) > Number(player1Score) ? (
            <p className="mt-1 text-xs font-semibold text-accent">
              {p2Name} wins — advances to the next round.
            </p>
          ) : null}
          {!isDrawPreview && (
            <p className="mt-0.5 text-[9px] text-slate-500">Entry fee already paid.</p>
          )}
        </div>
      )}

      {/* REQUIRED screenshot */}
      <div className="mt-1 rounded-lg border border-blue-500/40 bg-blue-500/10 p-2">
        <p className="mb-1 text-xs font-bold text-blue-400">SCREENSHOT PROOF — REQUIRED</p>
        <input type="file" accept="image/*" onChange={handleScreenshot} disabled={uploading}
          className="w-full text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-bold file:text-black hover:file:bg-accent-soft" />
        {screenshotUrl ? (
          <p className="mt-1 text-xs text-accent">Screenshot uploaded ✓</p>
        ) : (
          <p className="mt-1 text-[10px] text-red-400">Upload a screenshot to submit the result.</p>
        )}
      </div>

      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      {msg && <p className="mt-2 text-xs text-accent">{msg}</p>}

      <button type="submit" disabled={loading || uploading || player1Score === "" || player2Score === "" || !screenshotUrl}
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-bold text-black hover:bg-accent-soft disabled:opacity-40">
        {loading ? "Submitting..." : "Submit Result"}
      </button>
    </form>
  );
}