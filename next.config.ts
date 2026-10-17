import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webflow Cloud sets basePath from the environment mount path (/portal).
  // Do not set basePath or assetPrefix here.
  serverExternalPackages: ["node:sqlite"],
  experimental: {
    // Next 16 turns this on by default. In dev it waits on the HMR debug
    // channel before hydrating, and that socket handshake fails in Chrome
    // (permessage-deflate). Client buttons and uploads then never attach.
    // Production and Webflow Cloud do not use the channel.
    reactDebugChannel: false,
  },
};

export default nextConfig;
