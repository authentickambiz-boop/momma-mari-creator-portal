import type { Metadata } from "next";
import { CommunityPanel } from "@/components/community-panel";
import { HomeScreen } from "@/components/home-screen";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Momma Mari Creator Portal",
  description: "Private deal desk for Momma Mari creators.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Momma Mari", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CommunityPanel />
        <HomeScreen />
      </body>
    </html>
  );
}
