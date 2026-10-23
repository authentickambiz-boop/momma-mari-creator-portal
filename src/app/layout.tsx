import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { Fraunces, Inter } from "next/font/google";
import { AnalyticsHooks } from "@/components/analytics-hooks";
import { CommunityPanel } from "@/components/community-panel";
import { HomeScreen } from "@/components/home-screen";
import { SeasonalThemeFrame } from "@/components/seasonal-theme";
import { SiteFooter } from "@/components/site-footer";
import { withBasePath } from "@/lib/format";
import { loadSeasonalPresentation } from "@/lib/seasonal-theme-request";
import "./globals.css";
import "./seasonal-theme.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-fraunces" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_SITE_URL || "https://www.mommamari.com"),
  title: "Momma Mari Creator Portal",
  description: "Private deal desk for Momma Mari creators.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Momma Mari", statusBarStyle: "default" },
  icons: { icon: withBasePath("/icon-192.png"), apple: withBasePath("/icon-192.png") },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const office = headerList.get("x-bot-office") === "1";
  const seasonal = await loadSeasonalPresentation();
  const pageStyle: CSSProperties | undefined = seasonal.active
    ? ({ "--cream": seasonal.active.palette.page } as CSSProperties)
    : undefined;
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`} data-seasonal={seasonal.active?.id} style={pageStyle}>
      <body>
        {office ? null : <SeasonalThemeFrame presentation={{ active: seasonal.active, hidden: seasonal.hidden }} />}
        {children}
        <AnalyticsHooks />
        {office ? null : <SiteFooter />}
        {office ? null : <CommunityPanel />}
        {office ? null : <HomeScreen />}
      </body>
    </html>
  );
}
