"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/app/actions/auth";
import { FlameIcon } from "@/app/components/Icons";

export default function SignupForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(signUp, {});

  useEffect(() => {
    if (state?.success && !state?.message) {
      router.push("/");
    }
  }, [state, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-night-900/80 p-6 backdrop-blur">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <FlameIcon size={28} />
          </div>
          <h1 className="mt-3 text-2xl font-extrabold text-white">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            You'll receive 1,000 free PromptCoin to start!
          </p>
        </div>

        {state?.error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {state.error}
          </div>
        )}

        {state?.success && state?.message && (
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
            {state.message}
            <div className="mt-2">
              <a href="/login" className="font-medium text-accent underline">
                Go to login
              </a>
            </div>
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-4">
          <input
            type="text"
            name="username"
            placeholder="Username"
            required
            autoComplete="username"
            className="h-12 w-full rounded-xl border border-line bg-night-800 px-4 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-accent"
          />
          <input
            type="text"
            name="displayName"
            placeholder="Display name (optional)"
            autoComplete="nickname"
            className="h-12 w-full rounded-xl border border-line bg-night-800 px-4 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-accent"
          />
          <input
            type="email"
            name="email"
            placeholder="Email address"
            required
            autoComplete="email"
            className="h-12 w-full rounded-xl border border-line bg-night-800 px-4 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-accent"
          />
          <input
            type="password"
            name="password"
            placeholder="Password (min 6 characters)"
            required
            autoComplete="new-password"
            minLength={6}
            className="h-12 w-full rounded-xl border border-line bg-night-800 px-4 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-accent"
          />
          <button
            type="submit"
            disabled={isPending}
            className="h-12 w-full rounded-xl bg-accent text-sm font-bold text-black transition-colors hover:bg-accent-soft disabled:opacity-50"
          >
            {isPending ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <a href="/login" className="font-bold text-accent hover:text-accent-soft transition-colors">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}