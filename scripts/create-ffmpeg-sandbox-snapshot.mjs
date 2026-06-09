import { Sandbox } from "@vercel/sandbox"

const FFMPEG_VERSION = "5.3.0"
const PUBLIC_SANS_EXTRALIGHT_URL =
  "https://github.com/uswds/public-sans/raw/refs/heads/main/fonts/otf/PublicSans-ExtraLight.otf"
const PUBLIC_SANS_FONT_DIR = "/usr/share/fonts/public-sans"

async function run(sandbox, command, args, label) {
  const result = await sandbox.runCommand(command, args)
  if (result.exitCode === 0) {
    return result
  }

  const stderr = await result.stderr().catch(() => "")
  throw new Error(`${label} failed${stderr ? `:\n${stderr}` : ""}`)
}

let sandbox
try {
  console.log("Creating snapshot source sandbox...")
  sandbox = await Sandbox.create({
    runtime: "node24",
    timeout: 20 * 60 * 1000,
    resources: { vcpus: 2 },
  })

  await run(
    sandbox,
    "sudo",
    [
      "dnf",
      "install",
      "-y",
      "fontconfig",
      "google-noto-sans-fonts",
      "google-noto-serif-fonts",
      "google-noto-sans-mono-fonts",
      "google-noto-emoji-fonts",
    ],
    "Installing fonts"
  )
  await run(sandbox, "sudo", ["mkdir", "-p", PUBLIC_SANS_FONT_DIR], "Creating Public Sans font dir")
  await run(
    sandbox,
    "curl",
    ["-fsSL", "-o", "/tmp/PublicSans-ExtraLight.otf", PUBLIC_SANS_EXTRALIGHT_URL],
    "Downloading Public Sans ExtraLight"
  )
  await run(
    sandbox,
    "sudo",
    ["cp", "/tmp/PublicSans-ExtraLight.otf", `${PUBLIC_SANS_FONT_DIR}/PublicSans-ExtraLight.otf`],
    "Installing Public Sans ExtraLight"
  )
  await run(sandbox, "sudo", ["fc-cache", "-f"], "Refreshing font cache")
  const fontMatch = await run(
    sandbox,
    "fc-match",
    ["-f", "%{family}\n", "Public Sans"],
    "Verifying Public Sans"
  )
  const matchedFamily = (await fontMatch.stdout()).trim()
  if (!matchedFamily.toLowerCase().includes("public sans")) {
    throw new Error(`Public Sans is not registered in fontconfig (fc-match returned "${matchedFamily}")`)
  }
  await run(
    sandbox,
    "npm",
    ["install", "--prefix", "/opt/unican-ffmpeg", `ffmpeg-static@${FFMPEG_VERSION}`],
    "Installing ffmpeg-static"
  )
  await run(
    sandbox,
    "sudo",
    [
      "node",
      "-e",
      "const fs=require('fs');const p=require('/opt/unican-ffmpeg/node_modules/ffmpeg-static');fs.copyFileSync(p,'/usr/local/bin/ffmpeg');fs.chmodSync('/usr/local/bin/ffmpeg',0o755)",
    ],
    "Installing FFmpeg binary"
  )
  const filters = await run(
    sandbox,
    "/usr/local/bin/ffmpeg",
    ["-hide_banner", "-filters"],
    "Verifying FFmpeg filters"
  )
  const encoders = await run(
    sandbox,
    "/usr/local/bin/ffmpeg",
    ["-hide_banner", "-encoders"],
    "Verifying FFmpeg encoders"
  )
  await run(sandbox, "fc-list", [], "Verifying installed fonts")

  if (!(await filters.stdout()).includes(" ass ")) {
    throw new Error("Snapshot FFmpeg binary does not include the ass/libass filter")
  }
  const encoderOutput = await encoders.stdout()
  if (!encoderOutput.includes("libx264") || !encoderOutput.includes(" aac ")) {
    throw new Error("Snapshot FFmpeg binary does not include libx264 and AAC encoders")
  }

  const snapshot = await sandbox.snapshot({ expiration: 0 })
  sandbox = undefined

  console.log("\nSnapshot ready.")
  console.log(`Set VERCEL_FFMPEG_SANDBOX_SNAPSHOT_ID=${snapshot.snapshotId} in Vercel.`)
} finally {
  await sandbox?.stop({ blocking: false }).catch(() => undefined)
}
