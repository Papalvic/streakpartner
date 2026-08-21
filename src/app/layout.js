import { Geist, Geist_Mono } from "next/font/google";
import PresenceProvider from "@/app/components/PresenceProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "StreakPartner — DLS Match Platform",
  description: "Compete in Dream League Soccer matches, win promptcoins and climb the leaderboard.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PresenceProvider>{children}</PresenceProvider>
      </body>
    </html>
  );
}
