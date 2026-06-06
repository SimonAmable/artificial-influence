import type { NextConfig } from "next";

const ffmpegTracingIncludes = [
  "./node_modules/ffmpeg-static/ffmpeg",
  "./node_modules/ffprobe-static/bin/linux/x64/ffprobe",
]

const remotionRuntimeTracingIncludes = [
  // @remotion/bundler resolves these browser entry files dynamically at render time.
  "./node_modules/remotion/package.json",
  "./node_modules/remotion/dist/esm/**/*",
  "./node_modules/@remotion/studio/package.json",
  "./node_modules/@remotion/studio/dist/esm/renderEntry.mjs",
  "./node_modules/@remotion/studio/dist/esm/chunk-6jf1natv.js",
  "./node_modules/@remotion/media-parser/package.json",
  "./node_modules/@remotion/media-parser/dist/esm/worker.mjs",
  "./node_modules/@remotion/captions/package.json",
  "./node_modules/@remotion/captions/dist/**/*.js",
  "./node_modules/@remotion/media/package.json",
  "./node_modules/@remotion/media/dist/esm/index.mjs",
  "./node_modules/@remotion/media/node_modules/mediabunny/package.json",
  "./node_modules/@remotion/media/node_modules/mediabunny/dist/modules/**/*.js",
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
      "./node_modules/@rspack/binding*/**/*",
      ...remotionRuntimeTracingIncludes,
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
