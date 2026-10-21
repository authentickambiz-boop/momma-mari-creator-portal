"use client";

import { useEffect, useRef } from "react";
import { seasonalEffects } from "@/lib/seasonal-theme";

/** A few tiny stars that follow a mouse on a desktop. Touch and reduced motion stay still. */
export function SeasonalSparkle() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const desktop = window.matchMedia("(min-width: 821px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let last = 0;
    let alive = 0;

    const allowed = () => seasonalEffects({
      reducedMotion: reduced.matches,
      decorationsOn: true,
      finePointer: fine.matches && desktop.matches,
    }).sparkle;

    const onMove = (event: PointerEvent) => {
      if (!allowed() || event.pointerType !== "mouse") return;
      if (event.timeStamp - last < 90 || alive >= 4) return;
      last = event.timeStamp;
      alive += 1;
      const spark = document.createElement("span");
      spark.className = alive % 2 === 0 ? "seasonal-spark seasonal-spark-lavender" : "seasonal-spark";
      spark.style.left = `${event.clientX}px`;
      spark.style.top = `${event.clientY}px`;
      node.appendChild(spark);
      window.setTimeout(() => {
        spark.remove();
        alive -= 1;
      }, 720);
    };

    const onChange = () => {
      if (allowed()) return;
      node.replaceChildren();
      alive = 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    fine.addEventListener("change", onChange);
    desktop.addEventListener("change", onChange);
    reduced.addEventListener("change", onChange);
    return () => {
      window.removeEventListener("pointermove", onMove);
      fine.removeEventListener("change", onChange);
      desktop.removeEventListener("change", onChange);
      reduced.removeEventListener("change", onChange);
      node.replaceChildren();
    };
  }, []);

  return <div ref={root} className="seasonal-sparkles" aria-hidden="true" />;
}
