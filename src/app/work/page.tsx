import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { publicPageMeta } from "@/lib/public-meta";
import { WORKED_WITH, visibleCaseStudies, visibleTestimonials } from "@/lib/proof";
import { BRAND_INQUIRY_HREF, PUBLIC_ROBOTS, REPLY_PROMISE } from "@/lib/public-site";

export const metadata: Metadata = {
  ...publicPageMeta({
    title: "Work · Momma Mari",
    description: "Brands the Momma Mari roster has worked with.",
    path: "/work",
  }),
  robots: PUBLIC_ROBOTS,
};

export default function WorkPage() {
  const studies = visibleCaseStudies();
  const quotes = visibleTestimonials();
  return (
    <PublicShell title="Work" lede="Creators on this roster have worked with these brands. Names are listed as text. We do not show a logo we do not have permission to use.">
      <ul className="logo-wall">
        {WORKED_WITH.map((brand) => <li key={brand}>{brand}</li>)}
      </ul>
      {studies.length > 0 ? (
        <section>
          <h2>Case studies</h2>
          {studies.map((study) => (
            <article key={study.id} className="card">
              <h3>{study.brand}</h3>
              <p>{study.goal}</p>
              <p>{study.deliverables}</p>
              <p>{study.results}</p>
              {study.quote ? <blockquote>{study.quote}</blockquote> : null}
            </article>
          ))}
        </section>
      ) : null}
      {quotes.length > 0 ? (
        <section>
          <h2>Testimonials</h2>
          {quotes.map((quote) => (
            <blockquote key={quote.id} className="card">
              <p>{quote.quote}</p>
              <footer>{quote.name}</footer>
            </blockquote>
          ))}
        </section>
      ) : null}
      <p><Link href={BRAND_INQUIRY_HREF}>Start a brief</Link>. {REPLY_PROMISE}</p>
    </PublicShell>
  );
}
