import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    return [
      { source: "/radar", destination: "/" },
      { source: "/competitors", destination: "/" },
      { source: "/enrichments", destination: "/" },
      { source: "/deployments", destination: "/" },
      { source: "/audit", destination: "/" },
      { source: "/settings", destination: "/" },
    ];
  },
};

export default nextConfig;
