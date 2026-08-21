"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import AvatarWithPresence from "@/app/components/AvatarWithPresence";
import { searchPlayers } from "@/app/actions/search";

export default function PlayerSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(null);

  const runSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.set("query", q.trim());
    const res = await searchPlayers(fd);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
      setResults([]);
      return;
    }
    setError("");
    setResults(res.players || []);
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(v), 400);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="🔍 Search username or display name"
          className="h-11 w-full rounded-xl border border-line bg-night-800 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent"
        />
      </div>

      {loading && <p className="mt-2 text-xs text-slate-500">Searching...</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">No players found.</p>
      )}

      {results.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {results.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-xl border border-line bg-night-800 px-2 py-1.5">
              <Link href={`/profile/${p.id}`}>
                <AvatarWithPresence userId={p.id} avatarId={p.avatar_id} size={28} className="shrink-0" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/profile/${p.id}`} className="block truncate text-sm font-semibold text-white hover:text-accent">
                  {p.display_name || p.username}
                </Link>
                <p className="text-[10px] text-slate-500">@{p.username}</p>
              </div>
              <button type="button" onClick={() => onSelect(p)}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-black hover:bg-accent-soft">
                Challenge
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}