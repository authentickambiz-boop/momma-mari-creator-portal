"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1>Something went wrong</h1>
        <p className="note">Your deals are still private. Nothing was emailed or charged. Try again, and if it keeps happening Kamron can check the server log.</p>
        <div className="stack">
          <button className="btn" type="button" onClick={() => reset()}>Try again</button>
          <Link className="btn ghost" href="/">Back to deals</Link>
        </div>
      </div>
    </div>
  );
}
