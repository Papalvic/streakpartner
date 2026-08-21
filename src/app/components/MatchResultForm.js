"use client";

import { useState } from "react";
import Avatar from "@/app/components/Avatar";
import { uploadMatchScreenshot, settleMatch } from "@/app/actions/matches";

export default function MatchResultForm({ match }) {
  const [challengerScore, setChallengerScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const challenger = match.challenger;
  const opponent = match.opponent;
  const challengeName = challenger?.display_name || challenger?.username || "Player 1";
  const opponentName = opponent?.display_name || opponent?.username || "Player 2";

  const hasBoth = challengerScore !== "" && opponentScore !== "";
  const isDraw = hasBoth && Number(challengerScore) === Number(opponentScore);

  const handleScreenshot = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setMsg("Uploading proof...");
    setUploading(true);
    const fd = new FormData();
    fd.set("matchId", match.id);
    fd.set("screenshot", file);
    const result = await uploadMatchScreenshot(fd);
    setUploading(false);
    if (result?.error) { setErr(result.error); setMsg(""); return; }
    setScreenshotUrl(result.screenshotUrl);
    setMsg("Screenshot uploaded ✓");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    const fd = new FormData();
    fd.set("matchId", match.id);
    // Always explicit challenger/opponent — server derives winner from these.
    fd.set("challengerScore", String(challengerScore));
    fd.set("opponentScore", String(opponentScore));
    if (screenshotUrl) fd.set("screenshotUrl", screenshotUrl);
    const result = await settleMatch(fd);
    setSubmitting(false);
    if (result?.error) { setErr(result.error); return; }
    setMsg("Result submitted! Winner (or draw) determined by the scores.");
    setChallengerScore("");
    setOpponentScore("");
    setScreenshotUrl("");
    e.target.reset();
  };

  const PlayerInput = ({ player, name, score, onScore }) => (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-night-900/60 p-3 text-center">
      <Avatar avatarId={player?.avatar_id} size={44} className="shrink-0 rounded-xl" />
      <p className="w-full truncate text-sm font-bold text-white">{name}</p>
      <p className="w-full truncate text-[11px] text-slate-500">@{player?.username}</p>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Score</span>
      <input type="number" min="0" step="1" value={score} onChange={(e) => onScore(e.target.value)} placeholder="0"
        className="h-12 w-20 rounded-xl border border-line bg-night-800 text-center text-2xl font-black text-white outline-none focus:border-accent" />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="g-card rounded-2xl p-4">
      <h3 className="mb-1 text-base font-bold text-white">SUBMIT MATCH RESULT</h3>
      <p className="mb-3 text-xs text-slate-400">Enter the final score exactly as played.</p>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <PlayerInput player={challenger} name={challengeName} score={challengerScore} onScore={setChallengerScore} />
        <PlayerInput player={opponent} name={opponentName} score={opponentScore} onScore={setOpponentScore} />
      </div>

      {/* Live preview with actual player identities */}
      {hasBoth && (
        <div className="mb-3 rounded-xl border border-line bg-night-900/60 p-3 text-center">
          <p className="text-sm font-black text-white">
            {challengeName} <span className="text-slate-500">{challengerScore} — {opponentScore}</span> {opponentName}
          </p>
          {isDraw ? (
            <p className="mt-1 text-xs font-bold text-blue-400">DRAW — STAKES RETURNED</p>
          ) : Number(challengerScore) > Number(opponentScore) ? (
            <p className="mt-1 text-xs font-semibold text-accent">{challengeName} wins — receives 10 PromptCoin</p>
          ) : (
            <p className="mt-1 text-xs font-semibold text-accent">{opponentName} wins — receives 10 PromptCoin</p>
          )}
        </div>
      )}

      {/* Optional screenshot */}
      <div className="mt-1">
        <span className="mb-1 block text-xs font-medium text-slate-400">Screenshot proof (optional)</span>
        <input type="file" accept="image/*" onChange={handleScreenshot} disabled={uploading}
          className="w-full text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-bold file:text-black hover:file:bg-accent-soft" />
        {msg && <p className="mt-1 text-xs text-accent">{msg}</p>}
      </div>

      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

      <button type="submit" disabled={submitting || uploading || challengerScore === "" || opponentScore === ""}
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-bold text-black transition-colors hover:bg-accent-soft disabled:opacity-40">
        {submitting ? "Submitting..." : "Submit Result"}
      </button>
      <div className="mt-2 space-y-1 text-center text-[10px] text-slate-500">
        <p>WIN → Winner receives 10 PromptCoin</p>
        <p>DRAW → Both players get their 5 PromptCoin back</p>
      </div>
    </form>
  );
}