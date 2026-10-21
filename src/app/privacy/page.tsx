import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import { LEGAL_EFFECTIVE_BANNER } from "@/lib/legal-banner";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata: Metadata = {
  ...publicPageMeta({
    title: "Privacy Policy · Momma Mari",
    description: "How Momma Mari LLC collects and uses information from creators and brands.",
    path: "/privacy",
  }),
  robots: PUBLIC_ROBOTS,
};

export default function PrivacyPage() {
  return (
    <PublicShell title="Privacy Policy" lede="Momma Mari LLC, a North Carolina company, runs mommamari.com and this creator portal.">
      <p className="legal-banner">{LEGAL_EFFECTIVE_BANNER}</p>
      <div className="card stack">
        <p>This policy covers the public site and the portal. It describes what we collect, why we keep it, and how to reach us.</p>
        <h2>What we collect</h2>
        <p>Brand briefs collect a company name, website, your name, title, work email, phone, campaign details, budget range, and billing contact. Creator applications collect a name, email, handles, follower counts, niche, and an optional note about rates. If you sign in with Google, we receive the account email Google shares with us. If a creator later connects Gmail or Drive, the portal stores the threads and files needed to run a deal, and only the people assigned to that creator can see them.</p>
        <h2>How we use it</h2>
        <p>We use this information to answer a brief, match a creator, run a campaign, and keep a record of the work. We do not sell personal information. We do not send a marketing email from a form on its own.</p>
        <h2>How long we keep it</h2>
        <p>Deal and brief records stay while we are working with you and for the time we need them for contracts, payments, and taxes. You can ask us to delete a brief that has not become a campaign.</p>
        <h2>Contact</h2>
        <p>Questions go to Kamron at Kamron@mommamari.com, or by mail to Momma Mari LLC in North Carolina.</p>
      </div>
    </PublicShell>
  );
}
