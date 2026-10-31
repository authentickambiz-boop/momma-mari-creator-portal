import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer wrap">
      <nav aria-label="Site">
        <a href="https://www.mommamari.com/">Home</a>
        <a href="https://www.mommamari.com/creators">Creators</a>
        <a href="https://www.mommamari.com/brands">Brands</a>
        <a href="https://www.mommamari.com/partner-with-us">Partner With Us</a>
        <a href="mailto:Kamron@mommamari.com">Kamron@mommamari.com</a>
        <a href="https://www.mommamari.com">mommamari.com</a>
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/faq">FAQ</Link>
        <Link href="/careers">Careers</Link>
        <Link href="/press">Press</Link>
        <Link href="/feedback">Feedback</Link>
        <Link href="/help">Help</Link>
        <Link href="/status">Status</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/our-standard">Kids in content</Link>
      </nav>
      <p>© {year} Momma Mari</p>
    </footer>
  );
}
