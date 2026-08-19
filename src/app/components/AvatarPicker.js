"use client";

import { useState } from "react";
import Avatar, { AVATAR_DEFS } from "@/app/components/Avatar";
import { saveAvatar } from "@/app/actions/social";

export default function AvatarPicker({ currentAvatarId = "gamer-1" }) {
  const [selected, setSelected] = useState(currentAvatarId);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    const fd = new FormData();
    fd.set("avatarId", selected);
    const result = await saveAvatar(fd);
    if (result?.error) setMsg(result.error);
    else setMsg("Avatar updated!");
    setSaving(false);
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {Object.keys(AVATAR_DEFS).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelected(key)}
            className={`rounded-xl p-1 transition-colors ${
              selected === key
                ? "ring-2 ring-accent bg-accent/10"
                : "hover:bg-night-800"
            }`}
          >
            <Avatar avatarId={key} size={52} className="mx-auto" />
          </button>
        ))}
      </div>
      {msg && <p className="mt-2 text-sm text-accent">{msg}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-3 h-11 w-full rounded-xl bg-accent text-sm font-bold text-black transition-colors hover:bg-accent-soft disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Avatar"}
      </button>
    </div>
  );
}