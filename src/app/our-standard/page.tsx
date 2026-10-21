import { PublicShell } from "@/components/public-shell";
import { KIDS_STANDARD } from "@/lib/kids-standard";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata = {
  title: "Kids in content · Momma Mari",
  description: "How Momma Mari handles child safety, privacy, work hours, earnings set aside, and consent.",
  robots: PUBLIC_ROBOTS,
};

export default function OurStandardPage() {
  return (
    <PublicShell title="Kids in content" lede="This is how Momma Mari handles children in creator work. A parent can always say no.">
      <div className="public-grid">
        {KIDS_STANDARD.map((section) => (
          <article key={section.id} className="card">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </div>
    </PublicShell>
  );
}
