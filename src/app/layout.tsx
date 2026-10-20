import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { CommunityPanel } from "@/components/community-panel";
import { HomeScreen } from "@/components/home-screen";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-fraunces" });

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
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        {children}
        <CommunityPanel />
        <HomeScreen />
      </body>
    </html>
  );
}
