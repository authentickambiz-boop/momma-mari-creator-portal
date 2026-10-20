"use client";

import { useEffect, useRef } from "react";

export function TabRow({ children, label = "Sections" }: { children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const current = ref.current?.querySelector("a.on");
    if (!(current instanceof HTMLElement)) return;
    current.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, []);
  return (
    <nav className="tabs" ref={ref} aria-label={label}>
      {children}
    </nav>
  );
}
