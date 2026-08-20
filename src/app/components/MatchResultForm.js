"use client";

import { useState } from "react";
import { uploadMatchScreenshot, settleMatch } from "@/app/actions/matches";

export default function MatchResultForm({ matchId }) {
  const [yourScore, setYourScore] = useState("");
  const [oppScore, setOppScore] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const handleScreenshot = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      setMsg("");
      return;
    }
    setScreenshotUrl(result.screenshotUrl);
    setMsg("Screenshot uploaded ✓");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    const fd = new FormData();
    fd.set("matchId", matchId);
    fd.set("yourScore", String(yourScore));
    fd.set("oppScore", String(oppScore));
    if (screenshotUrl) fd.set("screenshotUrl", screenshotUrl);
    const result = await settleMatch(fd);
    setSubmitting(false);
    if (result?.error) {
      setErr(result.error);
      return;
    }
    setMsg("Result submitted! Winner (or draw) determined by the scores.");
    setYourScore("");
    setOppScore("");
    setScreenshotUrl("");
    e.target.reset();
  };

  return (
    <form onSubmit={handleSubmit} className="g-card rounded-2xl p-4">
      <h3 className="mb-3 text-base font-bold text-white">Submit Result</h3>
      <p className="mb-3 text-xs text-slate-400">
        Enter the final scores. The result is determined automatically — you cannot pick the winner.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Your score</span>
          <input type="number" min="0" step="1" required value={yourScore}
            onChange={(e) => setYourScore(e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-night-800 px-3 text-center text-2xl font-black text-white outline-none focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Opponent score</span>
          <input type="number" min="0" step="1" required value={oppScore}
            onChange={(e) => setOppScore(e.target.value)}
            className="h-12 w-full rounded-xl border border-line bg-night-800 px-3 text-center text-2xl font-black text-white outline-none focus:border-accent" />
        </label>
      </div>

      {/* Optional screenshot */}
      <div className="mt-3">
        <span className="mb-1 block text-xs font-medium text-slate-400">Screenshot proof (optional)</span>
        <input type="file" accept="image/*" onChange={handleScreenshot} disabled={uploading}
          className="w-full text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-bold file:text-black hover:file:bg-accent-soft" />
        {msg && <p className="mt-1 text-xs text-accent">{msg}</p>}
      </div>

      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

      <button type="submit" disabled={submitting || uploading}
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