"use client";

import { useState } from "react";

export default function CopyCode({ code }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  };
  return (
    <button type="button" onClick={handleCopy}
      className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black hover:bg-accent-soft">
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}