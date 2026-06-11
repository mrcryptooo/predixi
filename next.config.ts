import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      {
        // Rewrite the Farcaster / Base Mini App domain manifest to an API route.
        // Next.js App Router does not support route segments that start with "."
        // or contain ".json" in the directory name, so we cannot place a route.ts
        // directly at src/app/.well-known/farcaster.json/. The rewrite is
        // transparent to the client — the canonical URL remains correct.
        source:      '/.well-known/farcaster.json',
        destination: '/api/farcaster-manifest',
      },
    ]
  },
};

export default nextConfig;
