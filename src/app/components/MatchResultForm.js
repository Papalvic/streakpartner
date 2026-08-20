"use client";

import { useState } from "react";
import { uploadMatchScreenshot, settleMatch } from "@/app/actions/matches";

export default function MatchResultForm({ matchId, isChallenger }) {
  const [challengerScore, setChallengerScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // Map inputs to the names the server expects based on role.
  const yourScoreName = isChallenger ? "challengerScore" : "opponentScore";
  const oppScoreName = isChallenger ? "opponentScore" : "challengerScore";

  const handleScreenshot = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshot(file);
    setErr("");
    setMsg("Uploading proof...");
    setUploading(true);

    const fd = new FormData();
    fd.set("matchId", matchId);
    fd.set("screenshot", file);
    const result = await uploadMatchScreenshot(fd);
    setUploading(false);

    if (result?.error) {
      setErr(result.error);
      setScreenshot(null);
      setMsg("");
      return;
    }
    setScreenshotUrl(result.screenshotUrl);
    setMsg("Screenshot uploaded ✓");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!screenshotUrl) {
      setErr("Please upload a screenshot proof first.");
      return;
    }
    setErr("");
    setSubmitting(true);

    const fd = new FormData();
    fd.set("matchId", matchId);
    fd.set(yourScoreName, String(challengerScore));
    fd.set(oppScoreName, String(opponentScore));
    fd.set("screenshotUrl", screenshotUrl);

    const result = await settleMatch(fd);
    setSubmitting(false);
    if (result?.error) {
      setErr(result.error);
      setMsg("");
      return;
    }
    setMsg("Result submitted! Winner determined by score.");
    setChallengerScore("");
    setOpponentScore("");
    setScreenshot(null);
  };

  return (
    <form onSubmit={handleSubmit} className="g-card rounded-2xl p-4">
      <h3 className="mb-3 text-base font-bold text-white">Submit Result</h3>
      <p className="mb-3 text-xs text-slate-400">
        Enter the final scores. The winner is determined automatically from the scores — you cannot pick the winner.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Your score</span>
          <input
            type="number"
            min="0"
            step="1"
            required
            value={challengerScore}
            onChange={(e) => setChallengerScore(e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-night-800 px-3 text-center text-2xl font-black text-white outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Opponent score</span>
          <input
            type="number"
            min="0"
            step="1"
            required
            value={opponentScore}
            onChange={(e) => setOpponentScore(e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-night-800 px-3 text-center text-2xl font-black text-white outline-none focus:border-accent"
          />
        </label>
      </div>

      {/* Screenshot upload */}
      <div className="mt-3">
        <span className="mb-1 block text-xs font-medium text-slate-400">Screenshot proof (required)</span>
        <input
          type="file"
          accept="image/*"
          onChange={handleScreenshot}
          disabled={uploading}
          className="w-full text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-bold file:text-black hover:file:bg-accent-soft"
        />
        {msg && <p className="mt-1 text-xs text-accent">{msg}</p>}
      </div>

      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

      <button
        type="submit"
        disabled={submitting || uploading || !screenshotUrl}
        className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-bold text-black transition-colors hover:bg-accent-soft disabled:opacity-40"
      >
        {submitting ? "Submitting..." : "Submit Result & Claim Pot"}
      </button>
      <p className="mt-2 text-center text-[10px] text-slate-500">
        Winner receives the full 10 PromptCoin pot.
      </p>
    </form>
  );
}