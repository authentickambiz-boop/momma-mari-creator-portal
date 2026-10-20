"use client";

import { useEffect, useRef } from "react";

export function TabRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const current = ref.current?.querySelector("a.on");
    if (!(current instanceof HTMLElement)) return;
    current.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, []);
  return (
    <nav className="tabs" ref={ref}>
      {children}
    </nav>
  );
}
