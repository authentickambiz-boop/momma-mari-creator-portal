"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function NavProgress() {
  const pathname = usePathname();
  const [from, setFrom] = useState<string | null>(null);
  const pending = from !== null && from === pathname;

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setFrom(pathname);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  if (!pending) return null;
  return <div className="nav-progress" role="status" aria-live="polite" aria-label="Opening page" />;
}
