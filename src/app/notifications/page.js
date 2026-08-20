import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/app/components/BottomNav";
import NotificationBell from "@/app/components/NotificationBell";
import { markAllNotificationsRead } from "@/app/actions/notifications";

function hrefFor(n) {
  if (n.type === "match") return `/matches/${n.related_id || ""}`;
  if (n.type === "tournament") return `/tournaments/${n.related_id || ""}`;
  if (n.type === "referral") return "/profile";
  return "/";
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, message, related_id, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-night-800 text-slate-300 hover:text-white">
              ←
            </Link>
            <h1 className="text-base font-extrabold text-white">Notifications</h1>
          </div>
          <NotificationBell currentUserId={user.id} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pt-4">
        {notifications && notifications.length > 0 && (
          <form action={markAllNotificationsRead} className="mb-4">
            <button type="submit" className="h-10 w-full rounded-xl bg-accent text-sm font-bold text-black hover:bg-accent-soft">
              Mark all as read
            </button>
          </form>
        )}

        {!notifications || notifications.length === 0 ? (
          <div className="g-card rounded-2xl p-8 text-center">
            <p className="text-4xl">🔔</p>
            <p className="mt-3 text-sm text-slate-400">No notifications yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={hrefFor(n)}
                className={`g-card-press rounded-2xl p-4 ${n.is_read ? "" : "border-l-4 border-l-accent bg-accent-glow"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">{n.title}</p>
                  {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
                </div>
                <p className="mt-1 text-xs text-slate-300">{n.message}</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {new Date(n.created_at).toLocaleDateString()}{" "}
                  {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>

      <BottomNav active="home" />
    </div>
  );
}