"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findMatchByCode } from "@/app/actions/matches";

export default function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const handleFind = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy("Searching...");
    const fd = new FormData();
    fd.set("code", code);
    const result = await findMatchByCode(fd);
    if (result?.error) {
      setErr(result.error);
      setBusy("");
      return;
    }
    // Found — navigate to the match room so the player can accept.
    router.push(`/matches/${result.matchId}`);
  };

  return (
    <form onSubmit={handleFind} className="g-card rounded-2xl p-4">
      <h3 className="mb-2 text-base font-bold text-white">Join Challenge</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="DLS-XXXXXXL"
          className="h-11 flex-1 rounded-xl border border-line bg-night-800 px-3 text-center text-sm font-bold tracking-widest text-white uppercase outline-none placeholder:text-slate-500 focus:border-accent"
        />
        <button type="submit" disabled={!code.trim() || !!busy}
          className="h-11 whitespace-nowrap rounded-xl bg-accent px-4 text-sm font-bold text-black hover:bg-accent-soft disabled:opacity-40">
          {busy ? "..." : "Find"}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      <p className="mt-2 text-[10px] text-slate-500">Enter a challenge code to find a pending match and accept it.</p>
    </form>
  );
}