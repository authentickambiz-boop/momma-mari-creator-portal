import type { Metadata } from "next";
import { withBasePath } from "./format";
import { packagePricesApproved } from "./package-prices-flag";
import { PUBLIC_ROBOTS } from "./public-site";

export const PUBLIC_SHARE_IMAGE = "/momma-logo.png";

export const PUBLIC_SITEMAP_PATHS = [
  "/services",
  "/packages",
  "/meet",
  "/work",
  "/our-standard",
  "/inquire",
  "/gift-guide",
  "/apply",
  "/roster",
  "/about",
  "/contact",
  "/faq",
  "/careers",
  "/press",
  "/privacy",
  "/terms",
] as const;

/** Sitemap entries. Unapproved package prices stay out. /pricing is public. */
export function sitemapPublicPaths(paths: readonly string[] = PUBLIC_SITEMAP_PATHS) {
  const listed = paths.filter((path) => path !== "/packages" || packagePricesApproved());
  if (!listed.includes("/pricing")) listed.push("/pricing");
  return listed;
}

/** Crawl allow-list. /packages stays allowed so its noindex tag can be read. */
export function robotsAllowPaths(paths: readonly string[] = PUBLIC_SITEMAP_PATHS) {
  const allow = [...paths];
  if (!allow.includes("/pricing")) allow.push("/pricing");
  return allow;
}

export function publicSiteOrigin() {
  return (process.env.PUBLIC_SITE_URL || "https://www.mommamari.com").replace(/\/$/, "");
}

export function publicAbsoluteUrl(path: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${publicSiteOrigin()}${withBasePath(suffix)}`;
}

export function publicPageMeta(input: { title: string; description: string; path: string }): Metadata {
  const url = publicAbsoluteUrl(input.path);
  const image = publicAbsoluteUrl(PUBLIC_SHARE_IMAGE);
  return {
    title: input.title,
    description: input.description,
    robots: PUBLIC_ROBOTS,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: "Momma Mari",
      type: "website",
      images: [{ url: image, alt: "Momma Mari" }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}
