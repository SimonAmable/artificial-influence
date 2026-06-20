import type { Edge, Node } from "@xyflow/react"
import {
  getDefaultAudioModel,
  getDefaultAudioVoiceId,
} from "@/lib/constants/audio"
import { DEFAULT_MOTION_COPY_MODEL_IDENTIFIER } from "@/lib/constants/models"
import {
  executeWorkflowWithRuntime,
  type WorkflowExecutionOptions,
  type WorkflowExecutionRuntime,
} from "./execution-core"
import type { ExecutionCallbacks } from "./types"

async function appendReferenceImagesToFormData(
  formData: FormData,
  referenceImageUrls: string[],
): Promise<void> {
  for (const referenceImageUrl of referenceImageUrls) {
    formData.append("referenceImageUrls", referenceImageUrl)
  }
}

function createBrowserRuntime(): WorkflowExecutionRuntime {
  return {
    async generateText({ prompt, currentText, images }) {
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          currentText,
          images,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Text generation failed")
      }

      const result = await response.json()
      return {
        text:
          typeof result.text === "string" && result.text.length > 0
            ? result.text
            : currentText,
      }
    },

    async generateImage({
      prompt,
      modelIdentifier,
      aspectRatio,
      enhancePrompt,
      referenceImageUrls,
    }) {
      const formData = new FormData()
      formData.append("prompt", prompt)
      formData.append("model", modelIdentifier)
      formData.append("enhancePrompt", String(enhancePrompt))
      formData.append("aspectRatio", aspectRatio)
      formData.append("aspect_ratio", aspectRatio)
      await appendReferenceImagesToFormData(formData, referenceImageUrls)

      const { generateImageAndWait } = await import("@/lib/generate-image-client")
      const result = await generateImageAndWait(formData)
      const imageUrls =
        result.images
          ?.map((image) => image?.url)
          .filter((url): url is string => typeof url === "string" && url.length > 0) ?? []
      const imageUrl = imageUrls[0] ?? result.image?.url
      if (!imageUrl) throw new Error("No image URL in response")
      return { imageUrl, imageUrls: imageUrls.length > 0 ? imageUrls : [imageUrl] }
    },

    async generateVideo({ imageUrl, videoUrl, prompt, mode }) {
      const { generateVideoAndWait } = await import("@/lib/generate-video-client")
      const result = await generateVideoAndWait("/api/generate-video", {
          imageUrl,
          videoUrl,
          imageStoragePath: "",
          videoStoragePath: "",
          prompt,
          mode,
          model: DEFAULT_MOTION_COPY_MODEL_IDENTIFIER,
      })
      if (!result.video?.url) throw new Error("No video URL in response")
      return { videoUrl: result.video.url as string }
    },

    async generateAudio({ text, provider, voice, model, stylePrompt, languageCode }) {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          provider,
          voice: voice || getDefaultAudioVoiceId(provider === "google" ? "google" : "inworld"),
          model: model || getDefaultAudioModel(provider === "google" ? "google" : "inworld"),
          stylePrompt,
          languageCode,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Audio generation failed")
      }

      const result = await response.json()
      const audioUrl = result.audio?.url || result.url
      if (!audioUrl) throw new Error("No audio URL in response")
      return { audioUrl: audioUrl as string }
    },
  }
}

export async function executeWorkflow(
  nodes: Node[],
  edges: Edge[],
  callbacks: ExecutionCallbacks,
  options: WorkflowExecutionOptions = {},
): Promise<void> {
  return executeWorkflowWithRuntime(nodes, edges, callbacks, createBrowserRuntime(), options)
}
