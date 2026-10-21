import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import { LEGAL_EFFECTIVE_BANNER } from "@/lib/legal-banner";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata: Metadata = {
  ...publicPageMeta({
    title: "Terms · Momma Mari",
    description: "Terms for using the Momma Mari site and creator portal.",
    path: "/terms",
  }),
  robots: PUBLIC_ROBOTS,
};

export default function TermsPage() {
  return (
    <PublicShell title="Terms" lede="These terms cover mommamari.com and the Momma Mari creator portal.">
      <p className="legal-banner">{LEGAL_EFFECTIVE_BANNER}</p>
      <div className="card stack">
        <p>Momma Mari LLC is a North Carolina company. Using the site or the portal means you agree to these terms and to the Privacy Policy.</p>
        <h2>The portal</h2>
        <p>Creators see their own deals. Brands use the public brief to tell us about a campaign. A form submission is a request, not a confirmed booking. We reply within 3 business days.</p>
        <h2>Campaigns</h2>
        <p>Fees, usage, and exclusivity are agreed in the campaign itself. The public pages do not publish a creator&apos;s private minimum. Nothing on a form charges a card.</p>
        <h2>Accounts</h2>
        <p>Sign in with the Google account we have on file. Do not share that access. We can close an account that breaks a campaign agreement or these terms.</p>
        <h2>Contact</h2>
        <p>Momma Mari LLC · Kamron@mommamari.com · mommamari.com</p>
      </div>
    </PublicShell>
  );
}
