"use client";

import { useState } from "react";
import { submitReport } from "@/app/actions/admin";

export default function ReportUser({ reportedUserId, currentUserId }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  if (!currentUserId || currentUserId === reportedUserId) return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    const fd = new FormData();
    fd.set("reportedUserId", reportedUserId);
    fd.set("reason", reason);
    if (file) fd.set("image", file);
    setBusy(true);
    const r = await submitReport(fd);
    setBusy(false);
    if (r?.error) return setErr(r.error);
    setReason("");
    setFile(null);
    setMsg("Report submitted to the admin. Thank you.");
    setOpen(false);
  };

  return (
    <div className="mt-5">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20">
        {open ? "Cancel Report" : "Report User"}
      </button>

      {open && (
        <form onSubmit={submit} className="mt-3 g-card rounded-2xl p-4">
          <p className="mb-2 text-sm font-bold text-white">Report this user</p>
          <textarea value={reason} onChange={(e) => e.target.value.length <= 2000 && setReason(e.target.value)}
            placeholder="Describe the issue (min 5 chars)..." rows={3}
            className="w-full resize-none rounded-xl border border-line bg-night-800 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent" />
          <span className="text-[10px] text-slate-500">{reason.length}/2000</span>

          <div className="mt-2">
            <span className="mb-1 block text-xs font-medium text-slate-400">Picture proof (optional)</span>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-bold file:text-black" />
          </div>

          {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
          {msg && <p className="mt-2 text-xs text-accent">{msg}</p>}

          <button type="submit" disabled={busy || reason.trim().length < 5}
            className="mt-3 h-10 w-full rounded-xl bg-red-500/80 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-40">
            {busy ? "Submitting..." : "Submit Report"}
          </button>
        </form>
      )}
    </div>
  );
}