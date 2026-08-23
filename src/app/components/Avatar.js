import React from "react";

// Original, locally-generated gaming avatars (no copyrighted characters).
// admin-1 / creator-1 are special: rendered as lion / crown icons.
export const AVATAR_DEFS = {
  "gamer-1": ["#25D366", "#1aa34f", "♠️"],
  "striker": ["#2563eb", "#1d4ed8", "S"],
  "keeper": ["#f59e0b", "#b45309", "K"],
  "cyber-1": ["#a855f7", "#7c3aed", "N"],
  "cyber-2": ["#06b6d4", "#0891b2", "R"],
  "cyber-3": ["#f97316", "#ea580c", "D"],
  "cyber-4": ["#ec4899", "#db2777", "H"],
  "cyber-5": ["#84cc16", "#4d7c0f", "A"],
  "cyber-6": ["#8b5cf6", "#6d28d9", "V"],
  "cyber-7": ["#64748b", "#475569", "T"],
  "cyber-8": ["#ef4444", "#dc2626", "M"],
  "cyber-9": ["#0ea5e9", "#0284c7", "O"],
  "futuristic-1": ["#14b8a6", "#0f766e", "C"],
  "futuristic-2": ["#f472b6", "#db2777", "Q"],
  "futuristic-3": ["#a3e635", "#65a30d", "X"],
  "futuristic-4": ["#60a5fa", "#2563eb", "J"],
  "esports-1": ["#d946ef", "#a21caf", "E"],
  "esports-2": ["#22c55e", "#16a34a", "Z"],
  "esports-3": ["#eab308", "#ca8a04", "F"],
  "esports-4": ["#ef4444", "#b91c1c", "W"],
  "gamer-2": ["#10b981", "#059669", "O"],
  "gamer-3": ["#6366f1", "#4f46e5", "I"],
  "gamer-4": ["#f43f5e", "#be123c", "U"],
  "badge-1": ["#38bdf8", "#0284c7", "B"],
  "badge-2": ["#84cc16", "#4d7c0f", "V"],
  "badge-3": ["#f97316", "#c2410c", "L"],
  "badge-4": ["#9ca3af", "#6b7280", "Y"],
  "badge-5": ["#a855f7", "#7e22ce", "D"],
  "badge-6": ["#facc15", "#ca8a04", "G"],
  "badge-7": ["#fbbf24", "#92400e", "R"],
  "badge-8": ["#334155", "#1e293b", "S"],
  "admin-1": ["#b45309", "#92400e", "L"],
  "creator-1": ["#6d28d9", "#581c87", "C"],
};

export const AVATAR_KEYS = Object.keys(AVATAR_DEFS);

export function Avatar({ avatarId = "gamer-1", size = 40, className = "" }) {
  const def = AVATAR_DEFS[avatarId] || AVATAR_DEFS["gamer-1"];
  const [c1, c2] = def;
  const gradId = `sp-av-${avatarId}`;
  const isAdmin = avatarId === "admin-1";
  const isCreator = avatarId === "creator-1";

  const path =
    isAdmin
      ? (
          <>
            <text x="50" y="60" textAnchor="middle" dominantBaseline="middle" fontSize="50" fill="#ffffff" fontWeight="900">L</text>
            <text x="50" y="86" textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="#ffffff" fontWeight="900">★</text>
          </>
        )
      : isCreator
        ? (
            <>
              <text x="50" y="58" textAnchor="middle" dominantBaseline="middle" fontSize="46" fill="#ffffff" fontWeight="900">👑</text>
            </>
          )
        : (
            <>
              <path d="M18 72 h26 l8 8 h14" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="3" fill="none" />
              <path d="M82 28 l-9 9 h-18 l-6 6" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="3" fill="none" />
              <circle cx="84" cy="82" r="3" fill="#fff" fillOpacity="0.6" />
              <circle cx="16" cy="16" r="3" fill="#fff" fillOpacity="0.6" />
              <text x="50" y="60" textAnchor="middle" dominantBaseline="middle" fontSize="42" fill="#ffffff" fontFamily="sans-serif" fontWeight="800">
                {def[2]}
              </text>
            </>
          );

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="20" fill={`url(#${gradId})`} />
      {path}
    </svg>
  );
}

export default Avatar;