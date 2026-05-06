import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import ffmpegStatic from "ffmpeg-static"
import ffprobeStatic from "ffprobe-static"

function tryBinaryFromShell(command: string): string | null {
  try {
    const stdout = execSync(command, { encoding: "utf8", windowsHide: true }).trim()
    const line = stdout.split(/\r?\n/).find((entry) => entry.length > 0)
    if (!line) return null
    const candidate = line.trim()
    return existsSync(candidate) ? candidate : null
  } catch {
    return null
  }
}

function resolveExistingBinary(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }

    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function getFfmpegPackagePath() {
  return typeof ffmpegStatic === "string" ? ffmpegStatic : null
}

function getFfprobePackagePath() {
  return typeof ffprobeStatic?.path === "string" ? ffprobeStatic.path : null
}

export function resolveFfmpegBinaryPath(): string | null {
  return resolveExistingBinary([
    process.env.FFMPEG_BINARY,
    process.env.FFMPEG_PATH,
    getFfmpegPackagePath(),
    tryBinaryFromShell(process.platform === "win32" ? "where.exe ffmpeg" : "command -v ffmpeg"),
  ])
}

export function resolveFfprobeBinaryPath(): string | null {
  return resolveExistingBinary([
    process.env.FFPROBE_BINARY,
    process.env.FFPROBE_PATH,
    getFfprobePackagePath(),
    tryBinaryFromShell(process.platform === "win32" ? "where.exe ffprobe" : "command -v ffprobe"),
  ])
}

export function describeFfmpegBinaryResolution() {
  return {
    platform: process.platform,
    ffmpeg: {
      env: process.env.FFMPEG_BINARY ?? process.env.FFMPEG_PATH ?? null,
      packagePath: getFfmpegPackagePath(),
      resolvedPath: resolveFfmpegBinaryPath(),
    },
    ffprobe: {
      env: process.env.FFPROBE_BINARY ?? process.env.FFPROBE_PATH ?? null,
      packagePath: getFfprobePackagePath(),
      resolvedPath: resolveFfprobeBinaryPath(),
    },
  }
}

export function createMissingFfmpegMessage() {
  const details = describeFfmpegBinaryResolution()
  return [
    "ffmpeg/ffprobe are unavailable on the server.",
    "For Vercel Linux deploys, include only the runtime binaries with next.config outputFileTracingIncludes for node_modules/ffmpeg-static/ffmpeg and node_modules/ffprobe-static/bin/linux/x64/ffprobe.",
    "If your host provides system binaries instead, set FFMPEG_BINARY and FFPROBE_BINARY to their absolute paths.",
    `Resolution details: ${JSON.stringify(details)}`,
  ].join(" ")
}
