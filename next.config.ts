import type { NextConfig } from "next";

const ffmpegBinaryPath =
  process.platform === "win32" ? "./node_modules/ffmpeg-static/ffmpeg.exe" : "./node_modules/ffmpeg-static/ffmpeg"

const ffmpegTracingIncludes = [
  ffmpegBinaryPath,
  `./node_modules/ffprobe-static/bin/${process.platform}/${process.arch}/${process.platform === "win32" ? "ffprobe.exe" : "ffprobe"}`,
]

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
  outputFileTracingIncludes: {
    "/api/chat": ffmpegTracingIncludes,
    "/api/autopost/publish": ffmpegTracingIncludes,
    "/api/cron/autopost-queue": ffmpegTracingIncludes,
    "/api/free-tools/tiktok-video-fixer": ffmpegTracingIncludes,
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
