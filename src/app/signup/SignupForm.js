"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/app/actions/auth";

export default function SignupForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(signUp, {});

  // On successful signup WITHOUT email confirmation, the action redirects to "/".
  // If email confirmation is ON, the action returns success + a message instead,
  // and we should NOT navigate (the user must verify their email first).
  useEffect(() => {
    if (state?.success && !state?.message) {
      router.push("/");
    }
  }, [state, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
        <h1 className="mb-1 text-2xl font-bold text-black dark:text-zinc-50">
          Create your account
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          You'll receive 1,000 free PromptCoin to start!
        </p>

        {state?.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </div>
        )}

        {state?.success && state?.message && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            {state.message}
            <div className="mt-2">
              <a
                href="/login"
                className="font-medium text-green-800 underline dark:text-green-300"
              >
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
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <input
            type="text"
            name="displayName"
            placeholder="Display name (optional)"
            autoComplete="nickname"
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <input
            type="email"
            name="email"
            placeholder="Email address"
            required
            autoComplete="email"
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <input
            type="password"
            name="password"
            placeholder="Password (min 6 characters)"
            required
            autoComplete="new-password"
            minLength={6}
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={isPending}
            className="h-12 w-full rounded-lg bg-zinc-900 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
          >
            {isPending ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-50">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}