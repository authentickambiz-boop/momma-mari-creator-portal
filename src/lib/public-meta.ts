import type { Metadata } from "next";
import { withBasePath } from "./format";
import { PUBLIC_ROBOTS } from "./public-site";

export const PUBLIC_SHARE_IMAGE = "/momma-logo.png";

export const PUBLIC_SITEMAP_PATHS = [
  "/services",
  "/packages",
  "/meet",
  "/work",
  "/our-standard",
  "/inquire",
  "/apply",
  "/roster",
  "/privacy",
  "/terms",
] as const;

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
