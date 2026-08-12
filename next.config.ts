import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useOffline: true,
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
