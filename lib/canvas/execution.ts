import type { Edge, Node } from "@xyflow/react"
import {
  DEFAULT_INWORLD_TTS_MODEL,
  DEFAULT_INWORLD_VOICE_ID,
} from "@/lib/constants/inworld-tts"
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
  for (let index = 0; index < referenceImageUrls.length; index += 1) {
    const referenceImageUrl = referenceImageUrls[index]

    try {
      const response = await fetch(referenceImageUrl)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const imageBlob = await response.blob()
      const imageType = imageBlob.type || "image/png"
      const imageExtension = imageType.split("/")[1] || "png"
      const imageFile = new File([imageBlob], `reference-${index}.${imageExtension}`, {
        type: imageType,
      })

      formData.append("referenceImages", imageFile)
    } catch (error) {
      console.error(`Error fetching workflow reference image ${index}:`, error)
    }
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
      const imageUrl = result.image?.url ?? result.images?.[0]?.url
      if (!imageUrl) throw new Error("No image URL in response")
      return { imageUrl }
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
      })
      if (!result.video?.url) throw new Error("No video URL in response")
      return { videoUrl: result.video.url as string }
    },

    async generateAudio({ text, voice, model }) {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: voice || DEFAULT_INWORLD_VOICE_ID,
          model: model || DEFAULT_INWORLD_TTS_MODEL,
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
