import type { MetadataRoute } from "next";
import { PUBLIC_SITEMAP_PATHS, publicAbsoluteUrl } from "@/lib/public-meta";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [...PUBLIC_SITEMAP_PATHS],
      disallow: ["/", "/api/", "/login", "/dashboard", "/deals"],
    },
    sitemap: publicAbsoluteUrl("/sitemap.xml"),
  };
}
