"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { FlameIcon } from "@/app/components/Icons";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, {});

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-night-900/80 p-6 backdrop-blur">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <FlameIcon size={28} />
          </div>
          <h1 className="mt-3 text-2xl font-extrabold text-white">Forgot Password</h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {state?.error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {state.error}
          </div>
        )}

        {state?.success && (
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
            {state.message}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-4">
          <input
            type="email"
            name="email"
            placeholder="Email address"
            required
            autoComplete="email"
            className="h-12 w-full rounded-xl border border-line bg-night-800 px-4 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-accent"
          />
          <button
            type="submit"
            disabled={isPending}
            className="h-12 w-full rounded-xl bg-accent text-sm font-bold text-black transition-colors hover:bg-accent-soft disabled:opacity-50"
          >
            {isPending ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          <Link href="/login" className="font-bold text-accent hover:text-accent-soft">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}