import { signUp } from "@/app/actions/auth";

export const metadata = {
  title: "Sign Up | StreakPartner",
};

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
        <h1 className="mb-1 text-2xl font-bold text-black dark:text-zinc-50">
          Create your account
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          You'll receive 1,000 free PromptCoin to start!
        </p>

        <form action={signUp} className="flex flex-col gap-4">
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
            className="h-12 w-full rounded-lg bg-zinc-900 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
          >
            Sign Up
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