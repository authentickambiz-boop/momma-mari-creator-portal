import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { KIDS_STANDARD_PATH } from "@/lib/kids-standard";
import { MEET_HREF, MEET_LABEL } from "@/lib/public-creators";

export function PublicShell({ title, lede, children }: { title: string; lede: string; children: React.ReactNode }) {
  return (
    <>
    <a className="skip" href="#main">Skip to content</a>
    <main id="main" className="wrap">
      <header className="public-head">
        <BrandMark sub="Creator management" />
        <nav className="public-nav" aria-label="Public">
          <Link href="/services">Services</Link>
          <Link href="/packages">Packages</Link>
          <Link href={MEET_HREF}>{MEET_LABEL}</Link>
          <Link href="/work">Work</Link>
          <Link href="/inquire">Work with us</Link>
          <Link href="/apply">Apply</Link>
          <Link href="/login">Creator login</Link>
        </nav>
      </header>
      <h1>{title}</h1>
      <p>{lede}</p>
      {children}
      <footer className="public-foot">
        <Link href={KIDS_STANDARD_PATH}>Kids in content</Link>
      </footer>
    </main>
    </>
  );
}
