import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/app/components/BottomNav";
import { TrophyIcon } from "@/app/components/Icons";

export default async function TournamentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <TrophyIcon size={20} />
            </div>
            <h1 className="text-base font-extrabold text-white">Tournaments</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg px-4 pt-8">
        <div className="g-card w-full rounded-2xl p-8 text-center">
          <p className="text-5xl">🏆</p>
          <h2 className="mt-3 text-lg font-bold text-white">Tournaments</h2>
          <p className="mt-1 text-sm text-slate-400">Tournaments are coming soon.</p>
        </div>
      </main>
      <BottomNav active="tournaments" />
    </div>
  );
}