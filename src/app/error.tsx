"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
    <a className="skip" href="#main">Skip to content</a>
    <div className="state-page" id="main">
      <div className="card login-card state-card">
        <BrandMark sub="Creator portal" />
        <p className="eyebrow">This page stopped</p>
        <h1>Something went wrong</h1>
        <p className="note alert" role="alert">Your deals are still private. Nothing was emailed or charged. Try again, and if it keeps happening Kamron can check the server log.</p>
        <div className="stack">
          <button className="btn" type="button" onClick={() => reset()}>Try again</button>
          <Link className="btn ghost" href="/">Back to deals</Link>
        </div>
      </div>
    </div>
    </>
  );
}
