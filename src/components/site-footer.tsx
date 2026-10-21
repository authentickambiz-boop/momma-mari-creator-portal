import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer wrap">
      <nav aria-label="Site">
        <a href="https://www.mommamari.com">mommamari.com</a>
        <a href="https://www.mommamari.com/brands">Brands</a>
        <a href="https://www.mommamari.com/about">About</a>
        <a href="https://www.mommamari.com/contact">Contact</a>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/our-standard">Kids in content</Link>
      </nav>
      <p>© {year} Momma Mari LLC (NC)</p>
    </footer>
  );
}
