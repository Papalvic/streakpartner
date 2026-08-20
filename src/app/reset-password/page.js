"use client";

import { useState, useEffect, useActionState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { resetPassword } from "@/app/actions/auth";
import { FlameIcon } from "@/app/components/Icons";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [state, formAction, isPending] = useActionState(resetPassword, {});

  // On mount, parse the recovery token from the hash/query and establish the session.
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        // Supabase appends the recovery token as #access_token=...
        const params = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = params.get("access_token");

        if (!accessToken) {
          // Possibly an expired/used link with no token.
          if (mounted) {
            setStatus("error");
            setError("This reset link is invalid or has already been used. Please request a new one.");
          }
          return;
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: params.get("refresh_token") || "",
        });

        if (sessionError) {
          if (mounted) {
            setStatus("error");
            setError("This reset link has expired or is no longer valid. Please request a new one.");
          }
          return;
        }

        if (mounted) setStatus("valid");
      } catch {
        if (mounted) {
          setStatus("error");
          setError("Something went wrong. Please request a new password reset link.");
        }
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-night-900/80 p-6 backdrop-blur">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <FlameIcon size={28} />
          </div>
          <h1 className="mt-3 text-2xl font-extrabold text-white">Reset Password</h1>
        </div>

        {status === "loading" && (
          <p className="text-center text-sm text-slate-400">Checking your reset link...</p>
        )}

        {status === "error" && (
          <>
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
            <Link href="/forgot-password" className="block text-center text-sm font-bold text-accent hover:text-accent-soft">
              Request a new reset link
            </Link>
          </>
        )}

        {status === "valid" && !state?.success && (
          <form action={formAction} className="flex flex-col gap-4">
            {state?.error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{state.error}</div>
            )}
            <input type="password" name="password" placeholder="New password" required autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-line bg-night-800 px-4 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-accent" />
            <input type="password" name="confirmPassword" placeholder="Confirm new password" required autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-line bg-night-800 px-4 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-accent" />
            <button type="submit" disabled={isPending}
              className="h-12 w-full rounded-xl bg-accent text-sm font-bold text-black transition-colors hover:bg-accent-soft disabled:opacity-50">
              {isPending ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}

        {status === "valid" && state?.success && (
          <>
            <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
              {state.message}
            </div>
            <Link href="/login" className="mt-4 block text-center text-sm font-bold text-accent hover:text-accent-soft">
              Return to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}