import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async redirects() {
    return [
      {
        source: '/:path((?!api/badges/metadata).*)',
        has: [{ type: 'host', value: 'predixi-base.vercel.app' }],
        destination: 'https://predixi.xyz/:path',
        permanent: true,
      },
    ]
  },

  async rewrites() {
    return [
      {
        source:      '/.well-known/farcaster.json',
        destination: '/api/farcaster-manifest',
      },
    ]
  },
};

export default nextConfig;
