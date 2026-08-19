import Link from "next/link";
import {
  HomeIcon,
  SwordsIcon,
  TrophyIcon,
  ChatIcon,
  LeaderboardIcon,
  UserIcon,
} from "./Icons";

const navItems = [
  { name: "Home", href: "/", icon: HomeIcon },
  { name: "Matches", href: "/matches", icon: SwordsIcon },
  { name: "Tournaments", href: "/tournaments", icon: TrophyIcon },
  { name: "Chat", href: "/chat", icon: ChatIcon },
  { name: "Leaderboard", href: "/leaderboard", icon: LeaderboardIcon },
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
        <Link
          href="/profile"
          className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
            active === "profile" ? "text-accent" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <UserIcon size={21} />
          Profile
        </Link>
      </div>
    </nav>
  );
}