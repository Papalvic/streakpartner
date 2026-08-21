"use client";

import Avatar from "@/app/components/Avatar";
import { usePresence } from "@/app/components/PresenceProvider";

// Existing avatar + optional glowing presence indicator (bottom-right).
export default function AvatarWithPresence({ userId, avatarId, size = 40, className = "" }) {
  const { online } = usePresence();
  const isOnline = userId ? online.has(userId) : false;

  return (
    <span className="relative inline-flex shrink-0">
      <Avatar avatarId={avatarId} size={size} className={className} />
      {isOnline && (
        <span
          className="absolute -bottom-0.5 -right-0.5 block rounded-full bg-accent"
          style={{
            width: size >= 40 ? 10 : 8,
            height: size >= 40 ? 10 : 8,
            boxShadow: "0 0 0 2px #070b12, 0 0 6px rgba(37,211,102,0.9)",
          }}
        />
      )}
    </span>
  );
}