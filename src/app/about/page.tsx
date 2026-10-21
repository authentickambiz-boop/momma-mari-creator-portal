import { PublicShell } from "@/components/public-shell";
import { ABOUT_STORY } from "@/lib/company-pages";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata = {
  ...publicPageMeta({
    title: "About Momma Mari",
    description: "How Momma Mari started, and what the creator portal is for.",
    path: "/about",
  }),
  robots: PUBLIC_ROBOTS,
};

export default function AboutPage() {
  return (
    <PublicShell title="About Momma Mari" lede="A manager, and a portal where each creator can see her own deals.">
      <p>{ABOUT_STORY}</p>
      <p>That is the story we have to tell. Photos and a longer team list wait until people have agreed to be shown.</p>
    </PublicShell>
  );
}
