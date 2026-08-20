"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/app/components/Avatar";
import PlayerSearch from "@/app/components/PlayerSearch";
import { createMatch } from "@/app/actions/matches";

export default function CreateMatchPanel() {
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handleSelect = (player) => setSelected(player);

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    setErr("");
    const fd = new FormData();
    fd.set("opponentId", selected.id);
    const res = await createMatch(fd);
    if (res?.error) {
      setErr(res.error);
      setBusy(false);
      return;
    }
    setBusy(false);
    if (res?.matchId) router.push(`/matches/${res.matchId}`);
  };

  return (
    <div>
      <PlayerSearch onSelect={handleSelect} />
      {selected && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-glow p-2">
          <Avatar avatarId={selected.avatar_id} size={28} className="shrink-0" />
          <span className="flex-1 truncate text-sm font-semibold text-white">{selected.display_name || selected.username}</span>
          <span className="text-[10px] text-slate-500">@{selected.username}</span>
        </div>
      )}

      {selected && (
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-2 h-11 w-full rounded-xl bg-accent text-sm font-bold text-black hover:bg-accent-soft disabled:opacity-50"
        >
          {busy ? "Creating..." : "Challenge · 5 PromptCoin"}
        </button>
      )}
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
    </div>
  );
}