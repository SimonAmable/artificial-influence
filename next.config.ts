import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Configure body size limit for API routes (Route Handlers)
  // This is separate from serverActions.bodySizeLimit
  middlewareClientMaxBodySize: '50mb',
};

export default nextConfig;
