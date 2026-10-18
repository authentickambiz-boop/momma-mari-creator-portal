import type { MetadataRoute } from "next";
import { withBasePath } from "@/lib/format";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Momma Mari Creator Portal",
    short_name: "Momma Mari",
    description: "Private deal desk for Momma Mari creators.",
    start_url: withBasePath("/"),
    scope: withBasePath("/"),
    display: "standalone",
    background_color: "#fff8f1",
    theme_color: "#c8654a",
    icons: [
      { src: withBasePath("/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: withBasePath("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
