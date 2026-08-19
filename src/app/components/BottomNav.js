import Link from "next/link";
import {
  HomeIcon,
  SwordsIcon,
  TrophyIcon,
  ChatIcon,
  LeaderboardIcon,
  UserIcon,
} from "./Icons";

// Feed icon (megaphone / chat bubble style)
function FeedIcon({ size = 21, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

const navItems = [
  { name: "Home", href: "/", icon: HomeIcon },
  { name: "Feed", href: "/feed", icon: FeedIcon },
  { name: "Matches", href: "/matches", icon: SwordsIcon },
  { name: "Tournaments", href: "/tournaments", icon: TrophyIcon },
  { name: "Chat", href: "/chat", icon: ChatIcon },
  { name: "Profile", href: "/profile", icon: UserIcon },
];

export default function BottomNav({ active = "home" }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-night-900/95 backdrop-blur-md">
      <div className="mx-auto grid w-full max-w-lg grid-cols-6 items-center px-1 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const isActive = active === item.name.toLowerCase();
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? "text-accent" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className={`relative ${isActive ? "text-accent" : ""}`}>
                <Icon size={21} />
                {isActive && (
                  <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />
                )}
              </span>
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}