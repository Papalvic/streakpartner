"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { logIn } from "@/app/actions/auth";

export default function LoginForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(logIn, {});

  // When login succeeds, the action redirects to "/" — but just in case,
  // if we get a success signal, navigate there.
  useEffect(() => {
    if (state?.success) {
      router.push("/");
    }
  }, [state, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
        <h1 className="mb-1 text-2xl font-bold text-black dark:text-zinc-50">
          StreakPartner
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Challenge players. Stake coins. Win matches.
        </p>

        {state?.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-4">
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
            placeholder="Password"
            required
            autoComplete="current-password"
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={isPending}
            className="h-12 w-full rounded-lg bg-zinc-900 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
          >
            {isPending ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
          No account?{" "}
          <a href="/signup" className="font-medium text-zinc-900 underline dark:text-zinc-50">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}