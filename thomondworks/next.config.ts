import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Images are hand-optimised at authoring time (sharp) and served as-is,
  // so the site deploys cleanly to fully static hosting.
  images: { unoptimized: true },
};

export default nextConfig;
