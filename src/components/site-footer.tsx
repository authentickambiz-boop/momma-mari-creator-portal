import Image from "next/image";
import Link from "next/link";
import { KIDS_STANDARD_PATH } from "@/lib/kids-standard";

const MENU = [
  ["Home", "https://www.mommamari.com/"],
  ["Creators", "https://www.mommamari.com/creators"],
  ["Brands", "https://www.mommamari.com/brands"],
  ["About", "https://www.mommamari.com/about"],
  ["Contact", "https://www.mommamari.com/contact"],
  ["Partner With Us", "https://www.mommamari.com/partner-with-us"],
  ["Privacy Policy", "https://www.mommamari.com/privacy"],
  ["Terms of Service", "https://www.mommamari.com/terms"],
] as const;

const SOCIAL = [
  ["LinkedIn", "https://linkedin.com/company/mommamari"],
  ["MariClare Instagram", "https://instagram.com/_mariclaremaclamroc_"],
  ["Facebook", "https://facebook.com/Mommamari"],
  ["MariClare TikTok", "https://tiktok.com/@_mariclaremaclamroc_"],
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="mm-foot-inner">
        <section className="mm-band" aria-label="Apply">
          <div>
            <p className="mm-band-eyebrow">Now accepting applications</p>
            <h2 className="mm-band-heading">Ready to grow your creator career?</h2>
            <p className="mm-band-lead">Tell us about your content and your goals. Brands can reach our team the same way.</p>
          </div>
          <div className="mm-band-actions">
            <a className="mm-band-btn-light" href="https://www.mommamari.com/portal/apply">Apply to join</a>
            <a className="mm-band-btn-ghost" href="https://www.mommamari.com/portal/inquire">Brand inquiry</a>
          </div>
        </section>
        <div className="mm-foot-grid">
          <nav className="mm-foot-col" aria-label="Menu">
            <p className="mm-foot-label">Menu</p>
            <div className="mm-foot-links">
              {MENU.map(([label, href]) => (
                <a key={href} className="mm-foot-pill" href={href}>{label}</a>
              ))}
            </div>
          </nav>
          <div className="mm-foot-brand">
            <Image src="/momma-mari-mark.png" alt="" width={48} height={48} className="mm-foot-mark" />
            <h2>Momma Mari</h2>
            <a className="mm-foot-contact" href="mailto:Kamron@mommamari.com">
              <MailIcon />
              <span>Kamron@mommamari.com</span>
            </a>
            <a className="mm-foot-contact" href="https://instagram.com/mommamarillc" target="_blank" rel="noopener noreferrer">
              <InstagramIcon />
              <span>@mommamarillc</span>
            </a>
          </div>
          <nav className="mm-foot-col" aria-label="Social">
            <p className="mm-foot-label">Social</p>
            <div className="mm-foot-links">
              {SOCIAL.map(([label, href]) => (
                <a key={href} className="mm-foot-pill" href={href} target="_blank" rel="noopener noreferrer">{label}</a>
              ))}
            </div>
          </nav>
        </div>
        <nav className="mm-foot-portal" aria-label="Portal">
          <Link href="/faq" prefetch>FAQ</Link>
          <Link href="/help" prefetch>Help</Link>
          <Link href="/status" prefetch>Status</Link>
          <Link href="/feedback" prefetch>Feedback</Link>
          <Link href="/careers" prefetch>Careers</Link>
          <Link href="/press" prefetch>Press</Link>
          <Link href={KIDS_STANDARD_PATH} prefetch>Kids in content</Link>
          <p>© {year} Momma Mari</p>
        </nav>
      </div>
    </footer>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="mm-foot-icon">
      <path fill="currentColor" d="M19 4H5a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm-.41 2-5.88 5.88a1 1 0 0 1-1.42 0L5.41 6ZM20 17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.41l5.88 5.88a3 3 0 0 0 4.24 0L20 7.41Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="mm-foot-icon">
      <path fill="currentColor" d="M12 7.2A4.8 4.8 0 1 0 16.8 12 4.8 4.8 0 0 0 12 7.2Zm0 7.9A3.1 3.1 0 1 1 15.1 12 3.1 3.1 0 0 1 12 15.1Zm5.1-8.15a1.12 1.12 0 1 1-1.12-1.12 1.12 1.12 0 0 1 1.12 1.12ZM12 4.4c-1.3 0-1.46 0-2.3.04-.8.03-1.35.17-1.67.29a2.7 2.7 0 0 0-1 1c-.12.32-.26.87-.29 1.67C6.4 8.54 6.4 8.7 6.4 12s0 3.46.04 4.3c.03.8.17 1.35.29 1.67a2.7 2.7 0 0 0 1 1c.32.12.87.26 1.67.29.84.04 1 .04 2.3.04s1.46 0 2.3-.04c.8-.03 1.35-.17 1.67-.29a2.7 2.7 0 0 0 1-1c.12-.32.26-.87.29-1.67.04-.84.04-1 .04-2.3s0-1.46-.04-2.3c-.03-.8-.17-1.35-.29-1.67a2.7 2.7 0 0 0-1-1c-.32-.12-.87-.26-1.67-.29-.84-.04-1-.04-2.3-.04Zm0-1.6c1.32 0 1.48 0 2.34.04 1.16.05 1.95.25 2.64.53a4.3 4.3 0 0 1 2.45 2.45c.28.69.48 1.48.53 2.64.04.86.04 1.02.04 2.34s0 1.48-.04 2.34c-.05 1.16-.25 1.95-.53 2.64a4.3 4.3 0 0 1-2.45 2.45c-.69.28-1.48.48-2.64.53-.86.04-1.02.04-2.34.04s-1.48 0-2.34-.04c-1.16-.05-1.95-.25-2.64-.53a4.3 4.3 0 0 1-2.45-2.45c-.28-.69-.48-1.48-.53-2.64C4 13.48 4 13.32 4 12s0-1.48.04-2.34c.05-1.16.25-1.95.53-2.64A4.3 4.3 0 0 1 7.02 4.57c.69-.28 1.48-.48 2.64-.53C10.52 4 10.68 4 12 4Z" />
    </svg>
  );
}
