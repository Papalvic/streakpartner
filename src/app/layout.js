import { redirect } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import PresenceProvider from "@/app/components/PresenceProvider";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default async function RootLayout({ children }) {
  // Resolve the authenticated user id server-side (HttpOnly session), since the
  // browser client has no session and cannot resolve presence itself.
  let userId = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;

    // Block already-logged-in banned users site-wide.
    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_banned")
        .eq("id", user.id)
        .single();
      if (profile?.is_banned) {
        await supabase.auth.signOut();
        redirect("/login?blocked=1");
      }
    }
  } catch {}
  // NOTE: `redirect` throws; the following only runs for non-blocked requests.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {}

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <PresenceProvider userId={userId}>{children}</PresenceProvider>
      </body>
    </html>
  );
}