import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { BRAND_INQUIRY_HREF, BRAND_INQUIRY_LABEL, PUBLIC_ROBOTS, SERVICES } from "@/lib/public-site";

export const metadata = {
  title: "Services · Momma Mari",
  description: "Brand partnerships and creator management from Momma Mari.",
  robots: PUBLIC_ROBOTS,
};

export default function ServicesPage() {
  return (
    <PublicShell title="Services" lede="Momma Mari works with brands and the creators on its roster.">
      <div className="public-grid">
        {SERVICES.map((service) => (
          <article key={service.title} className="card">
            <h2>{service.title}</h2>
            <p>{service.body}</p>
          </article>
        ))}
      </div>
      <p><Link href={BRAND_INQUIRY_HREF}>{BRAND_INQUIRY_LABEL}</Link>. That form saves a brand contact. It does not send an email.</p>
    </PublicShell>
  );
}
