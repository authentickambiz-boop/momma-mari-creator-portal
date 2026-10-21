"use client";

import { useSyncExternalStore } from "react";
import { pageGuideStartsOpen, pageGuideStorageKey, type PageGuide } from "@/lib/page-guides";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function serverGuideSnapshot() {
  return null;
}

function notifyGuides() {
  for (const listener of listeners) listener();
}

export function PageGuide({ guide }: { guide: PageGuide }) {
  const stored = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(pageGuideStorageKey(guide.id)),
    serverGuideSnapshot,
  );
  const open = pageGuideStartsOpen(stored);

  function toggle() {
    window.localStorage.setItem(pageGuideStorageKey(guide.id), open ? "collapsed" : "open");
    notifyGuides();
  }

  return (
    <section className="card page-guide" data-guide={guide.id} aria-labelledby={`guide-${guide.id}`}>
      <h2 id={`guide-${guide.id}`} className="page-guide-heading">
        <button type="button" className="page-guide-toggle" aria-expanded={open} onClick={toggle}>
          <span>How to use this page</span>
          <span className="page-guide-chevron">{open ? "Hide" : "Show"}</span>
        </button>
      </h2>
      {open ? (
        <div className="page-guide-body">
          <p className="page-guide-who">{guide.who}</p>
          <p><b>What it&apos;s for.</b> {guide.purpose}</p>
          <p><b>The idea.</b> {guide.principle}</p>
          <p className="sec-title">How to use it</p>
          <ol>
            {guide.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
