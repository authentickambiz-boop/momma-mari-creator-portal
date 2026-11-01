import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webflow Cloud sets basePath from the environment mount path (/portal).
  // Do not set basePath or assetPrefix here.
  // Source and destination are prefixed with that basePath at build time,
  // so /plans becomes /portal/plans in production.
  async redirects() {
    return [
      { source: "/plans", destination: "/pricing", permanent: false },
      { source: "/admin/world", destination: "/worlds", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/desktop/latest.json", destination: "/api/desktop/latest" },
    ];
  },
  serverExternalPackages: ["node:sqlite"],
  experimental: {
    // Dynamic portal tabs stay in the client cache so a second visit is instant.
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
    // Next 16 turns this on by default. In dev it waits on the HMR debug
    // channel before hydrating, and that socket handshake fails in Chrome
    // (permessage-deflate). Client buttons and uploads then never attach.
    // Production and Webflow Cloud do not use the channel.
    reactDebugChannel: false,
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
