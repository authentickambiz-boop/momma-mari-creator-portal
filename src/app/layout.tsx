import type { Metadata } from "next";
import { CommunityPanel } from "@/components/community-panel";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Momma Mari Creator Portal",
  description: "Private deal desk for Momma Mari creators.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CommunityPanel />
      </body>
    </html>
  );
}
