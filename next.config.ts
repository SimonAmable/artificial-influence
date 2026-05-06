import type { NextConfig } from "next";

const ffmpegTracingIncludes = [
  "./node_modules/ffmpeg-static/**/*",
  "./node_modules/ffprobe-static/**/*",
]

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: [
    "ffmpeg-static",
    "ffprobe-static",
    "@remotion/bundler",
    "@remotion/vercel",
    "@vercel/functions",
    "@vercel/sandbox",
    "esbuild",
  ],
  outputFileTracingIncludes: {
    "/api/chat": ffmpegTracingIncludes,
    "/api/autopost/publish": ffmpegTracingIncludes,
    "/api/cron/autopost-queue": ffmpegTracingIncludes,
    "/api/free-tools/tiktok-video-fixer": ffmpegTracingIncludes,
    "/api/editor/render": [
      "./remotion-renderer/package.json",
      "./remotion-renderer/package-lock.json",
      "./remotion-renderer/tsconfig.json",
      "./remotion-renderer/src/**/*",
    ],
  },
  async redirects() {
    return [
      {
        source: "/influencer-generator",
        destination: "/inpaint",
        permanent: true,
      },
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Request bodies through middleware/proxy (default 10MB). Needed for large JSON to /api/*
    proxyClientMaxBodySize: '50mb',
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // serverActions.bodySizeLimit = Server Actions only; proxyClientMaxBodySize = middleware/proxy buffering
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
