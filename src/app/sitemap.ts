import type { MetadataRoute } from "next";
import { PUBLIC_SITEMAP_PATHS, publicAbsoluteUrl, sitemapPublicPaths } from "@/lib/public-meta";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapPublicPaths(PUBLIC_SITEMAP_PATHS).map((path) => ({
    url: publicAbsoluteUrl(path),
    changeFrequency: "weekly" as const,
    priority: path === "/meet" || path === "/work" ? 0.8 : 0.6,
  }));
}
