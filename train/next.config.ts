import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next writes its own AGENTS.md and CLAUDE.md on every dev start. This
  // repository already documents itself, and a generated file appearing in
  // `git status` after every `npm run dev` is noise, not guidance.
  agentRules: false,
  experimental: {
    // Activity uploads. The browser gzips a file before sending it, so this
    // covers a 12-hour GPX; it stays under Vercel's 4.5 MB request ceiling.
    serverActions: { bodySizeLimit: '4.4mb' },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'ironmiles.ie' }],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
