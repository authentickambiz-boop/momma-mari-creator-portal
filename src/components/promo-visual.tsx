"use client";

import { useState } from "react";
import { brandInitial, type PromoChoice } from "@/lib/promo-image";

export function PromoVisual({
  visual,
  brand,
  compact = false,
  showCheck = false,
  linkSource = true,
  alt,
}: {
  visual: PromoChoice | null;
  brand: string;
  compact?: boolean;
  showCheck?: boolean;
  linkSource?: boolean;
  alt?: string;
}) {
  const initial = brandInitial(brand);
  return (
    <figure className={compact ? "promo-visual compact" : "promo-visual"} data-promo-source={visual?.source ?? "none"}>
      {visual ? <PromoImg src={visual.url} alt={alt || visual.alt} initial={initial} /> : (
        <span className="promo-placeholder" aria-label={`${brand} product image is not on file`}>{initial}</span>
      )}
      <figcaption className="promo-source">
        {visual ? (
          <>
            {visual.sourceLabel}
            {linkSource && visual.source === "website" && visual.pageUrl ? (
              <> · <a href={visual.pageUrl}>Open the product page</a></>
            ) : null}
            {showCheck && visual.needsCheck ? <strong className="promo-check"> Image needs check</strong> : null}
          </>
        ) : "No product image yet"}
      </figcaption>
    </figure>
  );
}

function PromoImg({ src, alt, initial }: { src: string; alt: string; initial: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="promo-placeholder" aria-hidden="true">{initial}</span>;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
