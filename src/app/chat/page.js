import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/app/components/BottomNav";
import { ChatIcon } from "@/app/components/Icons";
import GeneralChatClient from "@/app/components/GeneralChatClient";

export default async function ChatPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Load initial messages server-side so RLS reads pass with the HttpOnly session.
  const { data: initialMessages } = await supabase
    .from("general_chat_messages")
    .select("id, user_id, content, created_at, user:profiles!general_chat_messages_user_id_fkey(username, display_name)")
    .order("created_at", { ascending: true })
    .limit(100);

  return (
    <div className="flex h-dvh flex-col pb-14">
      <header className="z-30 border-b border-line bg-night/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <ChatIcon size={20} />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white">General Chat</h1>
              <p className="text-[10px] text-slate-400">Community channel</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /> LIVE
          </span>
        </div>
      </header>

      <GeneralChatClient currentUserId={user.id} initialMessages={initialMessages || []} />

      <BottomNav active="chat" />
    </div>
  );
}
