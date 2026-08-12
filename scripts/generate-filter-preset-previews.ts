/**
 * Generate filter-preset thumbnail images from the influencer base photo.
 *
 * Usage (from deep-shadcn):
 *   npm run generate:filter-previews
 */
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import { applyGradingCpu } from "../lib/image-editor/grading-cpu.ts"
import { MAX_PRESET_GRAIN } from "../lib/image-editor/minigl-params.ts"
import { buildMiniGlPipeline } from "../lib/image-editor/minigl-pipeline.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const PRESETS_JSON = path.join(ROOT, "lib", "image-editor", "filter-presets.json")

const PREVIEW_WIDTH = 160
const PREVIEW_HEIGHT = 90
const PREVIEW_QUALITY = 82

function publicPathToDisk(publicUrl: string): string {
  const relative = publicUrl.replace(/^\//, "").replace(/\//g, path.sep)
  return path.join(ROOT, "public", relative)
}

async function renderPresetPreview(
  sourcePath: string,
  preset: {
    settings: import("../lib/image-editor/types.ts").ImageFilterSettings
    minigl?: import("../lib/image-editor/minigl-params.ts").MiniGlPresetConfig
  }
): Promise<Buffer> {
  const pipeline = buildMiniGlPipeline(preset.settings, preset.minigl)

  const resized = await sharp(sourcePath)
    .rotate()
    .resize(PREVIEW_WIDTH, PREVIEW_HEIGHT, {
      fit: "cover",
      position: "centre",
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const graded = applyGradingCpu(
    new Uint8ClampedArray(resized.data),
    resized.info.width,
    resized.info.height,
    pipeline
  )

  return sharp(Buffer.from(graded), {
    raw: {
      width: resized.info.width,
      height: resized.info.height,
      channels: resized.info.channels,
    },
  })
    .webp({ quality: PREVIEW_QUALITY })
    .toBuffer()
}

async function main() {
  const catalog = JSON.parse(await fs.readFile(PRESETS_JSON, "utf8"))
  const sourcePath = publicPathToDisk(catalog.sourceImage)
  const outDir = publicPathToDisk(catalog.previewDir)

  try {
    await fs.access(sourcePath)
  } catch {
    console.error(`Source image not found:\n  ${sourcePath}`)
    process.exit(1)
  }

  await fs.mkdir(outDir, { recursive: true })

  console.log(`Source:  ${sourcePath}`)
  console.log(`Output:  ${outDir}`)
  console.log(`Engine:  mini-gl / glfx CPU grading`)
  console.log(`Presets: ${catalog.presets.length}`)
  console.log("")

  for (const preset of catalog.presets) {
    if (preset.settings.grain > MAX_PRESET_GRAIN) {
      console.error(
        `Preset "${preset.id}" grain ${preset.settings.grain} exceeds max preset grain ${MAX_PRESET_GRAIN}`
      )
      process.exit(1)
    }
    const outPath = path.join(outDir, `${preset.id}.webp`)
    const buffer = await renderPresetPreview(sourcePath, preset)
    await fs.writeFile(outPath, buffer)
    console.log(
      `✓ ${preset.id.padEnd(14)} ${preset.label} → ${path.basename(outPath)} (${buffer.length} bytes)`
    )
  }

  console.log("")
  console.log("Done. Hard-refresh the editor to see updated thumbnails.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
