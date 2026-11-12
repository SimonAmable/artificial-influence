const QWEN_IMAGE_21_ASPECT_RATIOS = new Set([
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "21:9",
  "9:21",
  "4:5",
  "5:4",
  "1:2",
  "2:1",
  "1:3",
  "3:1",
])

export type QwenImage21WaveSpeedLora = {
  path: string
  scale: number
}

export type QwenImage21WaveSpeedRequestOptions = {
  prompt: string | null
  referenceImageUrls: string[]
  aspectRatio: string | null
  resolution: string | null
  outputFormat: string | null
  seed: number | string | null
  loras?: QwenImage21WaveSpeedLora[] | null
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function uniqueUrls(values: string[], max: number): string[] {
  const urls: string[] = []
  for (const value of values) {
    const url = text(value)
    if (!url || urls.includes(url)) continue
    urls.push(url)
    if (urls.length >= max) break
  }
  return urls
}

function resolution(value: unknown): "1k" | "1.5k" | "2k" {
  const raw = text(value)?.toLowerCase().replace(/\s/g, "")
  if (raw === "1.5k" || raw === "1536" || raw === "1.5") return "1.5k"
  if (raw === "2k" || raw === "2048" || raw === "2") return "2k"
  return "1k"
}

function outputFormat(value: unknown): "jpeg" | "png" | "webp" {
  const raw = text(value)?.toLowerCase()
  if (raw === "jpeg" || raw === "jpg") return "jpeg"
  if (raw === "webp") return "webp"
  return "png"
}

function seed(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2147483647) return null
  return parsed
}

function loraScale(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN
  if (!Number.isFinite(parsed)) return 1
  return Math.min(4, Math.max(0, parsed))
}

function normalizeLoras(loras: QwenImage21WaveSpeedLora[] | null | undefined): QwenImage21WaveSpeedLora[] {
  if (!loras?.length) return []
  const out: QwenImage21WaveSpeedLora[] = []
  for (const item of loras) {
    const path = text(item.path)
    if (!path) continue
    out.push({ path, scale: loraScale(item.scale) })
    if (out.length >= 3) break
  }
  return out
}

export function buildQwenImage21WaveSpeedRequest(options: QwenImage21WaveSpeedRequestOptions): {
  endpoint: string
  input: Record<string, unknown>
  resolvedAspectRatio: string
} {
  const prompt = text(options.prompt)
  if (!prompt) throw new Error("Qwen Image 2.1 requires a prompt.")
  const images = uniqueUrls(options.referenceImageUrls, 10)
  const explicitAspect = text(options.aspectRatio)
  const ratio =
    explicitAspect && QWEN_IMAGE_21_ASPECT_RATIOS.has(explicitAspect) ? explicitAspect : null
  const input: Record<string, unknown> = {
    prompt,
    resolution: resolution(options.resolution),
    output_format: outputFormat(options.outputFormat),
  }
  if (ratio) input.aspect_ratio = ratio
  const chosenSeed = seed(options.seed)
  if (chosenSeed != null) input.seed = chosenSeed
  const loras = normalizeLoras(options.loras)
  if (loras.length > 0) input.loras = loras
  if (images.length > 0) {
    input.images = images
    return {
      endpoint: "wavespeed-ai/qwen-image-2.1/edit-lora",
      input,
      resolvedAspectRatio: ratio ?? "auto",
    }
  }
  return {
    endpoint: "wavespeed-ai/qwen-image-2.1/text-to-image-lora",
    input: {
      ...input,
      aspect_ratio: ratio ?? "1:1",
    },
    resolvedAspectRatio: ratio ?? "1:1",
  }
}
