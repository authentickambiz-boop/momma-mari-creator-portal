import type { MetadataRoute } from "next";
import { PUBLIC_SITEMAP_PATHS, publicAbsoluteUrl, robotsAllowPaths } from "@/lib/public-meta";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: robotsAllowPaths(PUBLIC_SITEMAP_PATHS),
      disallow: ["/", "/api/", "/login", "/dashboard", "/deals"],
    },
    sitemap: publicAbsoluteUrl("/sitemap.xml"),
  };
}
