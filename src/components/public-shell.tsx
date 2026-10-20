import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export function PublicShell({ title, lede, children }: { title: string; lede: string; children: React.ReactNode }) {
  return (
    <main className="wrap">
      <header className="public-head">
        <BrandMark sub="Creator management" />
        <nav className="public-nav">
          <Link href="/services">Services</Link>
          <Link href="/roster">Creators</Link>
          <Link href="/inquire">Work with us</Link>
          <Link href="/apply">Apply</Link>
          <Link href="/login">Creator login</Link>
        </nav>
      </header>
      <h1>{title}</h1>
      <p>{lede}</p>
      {children}
    </main>
  );
}
