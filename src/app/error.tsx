"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { reportPortalError } from "@/app/error-report";
import { BrandMark } from "@/components/brand-mark";
import { portalErrorRef } from "@/lib/portal-error";

export default function ErrorPage({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  const digest = typeof error?.digest === "string" ? error.digest : "";
  const [ref, setRef] = useState(digest ? portalErrorRef(digest) : "");
  const reloadTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancel = false;
    reportPortalError({
      message: error instanceof Error ? error.message : "",
      digest,
      stack: error instanceof Error ? error.stack : "",
    }).then((id) => {
      if (!cancel && id) setRef(id);
    }).catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [digest, error]);

  useEffect(() => () => {
    if (reloadTimer.current != null) window.clearTimeout(reloadTimer.current);
  }, []);

  function tryAgain(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (reloadTimer.current != null) window.clearTimeout(reloadTimer.current);
    // retry() re-fetches the server render. reset() only clears the boundary,
    // which leaves a server failure on this page. Reload if that does not recover.
    reloadTimer.current = window.setTimeout(() => {
      window.location.reload();
    }, 800);
    try {
      if (typeof retry === "function") retry();
      else reset?.();
    } catch {
      window.location.reload();
    }
  }

  return (
    <>
    <a className="skip" href="#main">Skip to content</a>
    <div className="state-page" id="main">
      <div className="card login-card state-card">
        <BrandMark sub="Creator portal" />
        <p className="eyebrow">This page stopped</p>
        <h1>Something went wrong</h1>
        <p className="note alert" role="alert">
          Your deals are still private. Nothing was emailed or charged. Try again, and if it keeps happening Kamron can check the server log.
          {ref ? ` Reference ${ref}.` : ""}
        </p>
        <div className="stack">
          <form action="" method="get" onSubmit={tryAgain}>
            <button className="btn" type="submit">Try again</button>
          </form>
          <Link className="btn ghost" href="/">Back to deals</Link>
        </div>
      </div>
    </div>
    </>
  );
}
