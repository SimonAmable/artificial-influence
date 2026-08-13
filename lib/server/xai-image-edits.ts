const MAX_XAI_REFERENCE_IMAGES = 3

export interface XaiImageEditsRequest {
  modelIdentifier: string
  prompt: string
  referenceImageUrls: string[]
  n?: number
  aspectRatio?: string | null
  quality?: "low" | "medium" | "high" | null
  resolution?: "1k" | "2k" | null
}

export function isXaiImageModelIdentifier(modelIdentifier: string): boolean {
  return modelIdentifier.startsWith("xai/")
}

export function shouldUseDirectXaiImageEdits(
  provider: string,
  modelIdentifier: string,
  referenceImageCount: number,
): boolean {
  if (referenceImageCount <= 0 || !isXaiImageModelIdentifier(modelIdentifier)) {
    return false
  }

  return provider === "xai" || provider === "gateway"
}

export async function callXaiImageEdits(
  request: XaiImageEditsRequest,
): Promise<string[]> {
  const xaiApiKey = process.env.XAI_API_KEY
  if (!xaiApiKey) {
    throw new Error(
      "XAI_API_KEY environment variable is not set (required for Grok image editing with reference images)",
    )
  }

  const modelId = request.modelIdentifier.replace(/^xai\//, "")
  const referenceImageUrls = request.referenceImageUrls.slice(0, MAX_XAI_REFERENCE_IMAGES)
  const imagePayload =
    referenceImageUrls.length === 1
      ? {
          image: {
            url: referenceImageUrls[0]!,
            type: "image_url" as const,
          },
        }
      : {
          images: referenceImageUrls.map((url) => ({
            url,
            type: "image_url" as const,
          })),
        }

  const aspectRatio =
    request.aspectRatio && /^\d+:\d+$/.test(request.aspectRatio)
      ? request.aspectRatio
      : undefined

  const response = await fetch("https://api.x.ai/v1/images/edits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${xaiApiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      prompt: request.prompt,
      ...imagePayload,
      response_format: "b64_json",
      ...(request.n != null && request.n > 1 ? { n: request.n } : {}),
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
      ...(request.quality ? { quality: request.quality } : {}),
      ...(request.resolution ? { resolution: request.resolution } : {}),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`xAI API error: ${response.status} - ${errorText}`)
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string }>
  }
  const base64Images = (payload.data ?? [])
    .map((item) => item.b64_json)
    .filter((value): value is string => typeof value === "string" && value.length > 0)

  if (base64Images.length === 0) {
    throw new Error("xAI edits API returned no images")
  }

  return base64Images
}

export function toXaiGenerateImageResult(base64Images: string[]) {
  const shared = { warnings: [] as unknown[], providerMetadata: undefined }
  return base64Images.length > 1
    ? {
        ...shared,
        images: base64Images.map((base64) => ({ base64 })),
      }
    : {
        ...shared,
        image: { base64: base64Images[0]! },
      }
}
