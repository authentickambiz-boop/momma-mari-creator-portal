import type { MetadataRoute } from "next";
import { PUBLIC_SITEMAP_PATHS, publicAbsoluteUrl } from "@/lib/public-meta";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SITEMAP_PATHS.map((path) => ({
    url: publicAbsoluteUrl(path),
    changeFrequency: "weekly" as const,
    priority: path === "/meet" || path === "/work" ? 0.8 : 0.6,
  }));
}
