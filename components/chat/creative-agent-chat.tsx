"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import type { UIMessage } from "ai"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai"
import { Chat, useChat } from "@ai-sdk/react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowUp,
  CircleNotch,
  ClockCounterClockwise,
  FilePlus,
  FolderOpen,
  Images,
  NotePencil,
  Palette,
  Plus,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation"
import { SpeechInput } from "@/components/ai-elements/speech-input"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { ImageGrid } from "@/components/shared/display/image-grid"
import { AssetSelectionModal } from "@/components/shared/modals/asset-selection-modal"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getModelMetadataCost } from "@/lib/constants/model-metadata"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CHAT_GATEWAY_MODEL_OPTIONS,
  DEFAULT_CHAT_GATEWAY_MODEL,
} from "@/lib/constants/chat-llm-models"
import { cn } from "@/lib/utils"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { extractAssetFromNode } from "@/lib/canvas/drag-utils"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { CommandTextarea } from "@/components/commands/command-textarea"
import type { AttachedRef } from "@/lib/commands/types"
import { CHAT_AGENT_COMMANDS } from "@/lib/commands/presets-chat"
import { extendMentionRangeEnd } from "@/lib/commands/mention-token"
import {
  refsToChatMetadata,
  type ChatReferenceMetadataItem,
} from "@/lib/chat/reference-metadata"

/** Serializable thread row for mobile history (matches ChatThreadListItem). */
type MobileChatThreadListItem = {
  id: string
  title: string
  updated_at: string
  source?: "user" | "automation"
  automation_trigger?: "manual" | "scheduled" | null
}

function formatThreadUpdatedAt(value: string) {
  const date = new Date(value)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return "Just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

const STARTER_PROMPTS: { label: string; prompt: string }[] = [
  { label: "What can this agent do?", prompt: "What can this agent do?" },
  {
    label: "Image prompt from a rough idea",
    prompt: "Turn my rough idea into a detailed image-generation prompt.",
  },
  {
    label: "Concept → finished visuals",
    prompt:
      "What workflow should I use to take this from concept to finished visuals?",
  },
  {
    label: "Break down a reference",
    prompt:
      "I’ll attach a reference. Break down what stands out and how to borrow from it.",
  },
  {
    label: "Visual traits as JSON",
    prompt:
      "I’ll attach an image. Extract detailed visual traits as JSON for a Nano Banana prompt.",
  },
  {
    label: "Verbose JSON from image (Nano Banana)",
    prompt:
      "Turn this image into a detailed JSON prompt. Use the full verbose Nano Banana blueprint: top-level keys prompt (with main_subject, scene, style object with art_style/lighting/color_palette/camera/mood, details array, text_in_image, characters, products, background, negative_prompts), technical, references, workflow, notes_for_model. Be exhaustive: rich strings, many detail bullets, thorough negative_prompts, and concrete notes_for_model like the reference examples. Output one pretty-printed JSON code block only after a short preamble.",
  },
  {
    label: "Notes → client brief",
    prompt: "Turn these notes into a clear, client-ready creative brief.",
  },
]

const IMAGE_FILENAME_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i
const VIDEO_FILENAME_EXT = /\.(mp4|webm|mov|m4v|mkv)$/i
const AUDIO_FILENAME_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)$/i
const MARKDOWN_IMAGE_URL_REGEX = /!\[[^\]]*]\((https?:\/\/[^\s)]+)\)/gi
const MARKDOWN_LINK_URL_REGEX = /\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/gi
const RAW_URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi

type MediaValueType = "image" | "video" | "audio" | "other"

type GenerateImageToolPart = {
  type: "tool-generateImageWithNanoBanana"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    aspectRatio?: string
    modelIdentifier?: string
    prompt: string
    variantCount?: number
  }
  output?: {
    aspectRatio?: string
    generationId?: string | null
    images?: Array<{
      mimeType?: string
      url: string
    }>
    message?: string
    model?: string
    predictionId?: string
    status?: "pending" | "completed" | "failed"
    usedReferenceCount?: number
    variantCount?: number
  }
  errorText?: string
}

type UniversalGenerateImageToolPart = {
  type: "tool-generateImage"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    aspectRatio?: string
    assetIds?: string[]
    enhancePrompt?: boolean
    modelIdentifier?: string
    prompt: string
    referenceIds?: string[]
    variantCount?: number
  }
  output?: {
    aspectRatio?: string | null
    creditsUsed?: number
    generationId?: string | null
    images?: Array<{
      mimeType?: string
      url: string
    }>
    message?: string
    model?: string
    predictionId?: string
    status?: "pending" | "completed" | "failed"
    usedReferenceCount?: number
    variantCount?: number
  }
  errorText?: string
}

type GenerateVideoToolPart = {
  type: "tool-generateVideo"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    aspectRatio?: string
    assetIds?: string[]
    characterOrientation?: "image" | "video"
    duration?: number
    generateAudio?: boolean
    keepOriginalSound?: boolean
    mode?: "pro" | "std"
    modelIdentifier?: string
    negativePrompt?: string
    prompt?: string
    referenceIds?: string[]
  }
  output?: {
    generationId?: string | null
    message?: string
    model?: string
    predictionId?: string
    status?: "pending" | "completed" | "failed"
    usedImageReferenceCount?: number
    usedVideoReferenceCount?: number
    usedAudioReferenceCount?: number
    video?: {
      mimeType?: string
      storagePath?: string | null
      url: string
    }
  }
  errorText?: string
}

type SearchModelsToolPart = {
  type: "tool-searchModels"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    type?: "image" | "video" | "audio" | "upscale"
  }
  output?: {
    message?: string
    models?: Array<{
      defaultAspectRatio?: string | null
      description?: string | null
      identifier: string
      maxImages?: number | null
      modelCost?: number | null
      name: string
      provider?: string | null
      supportsFirstFrame?: boolean
      supportsLastFrame?: boolean
      supportsReferenceAudio?: boolean
      supportsReferenceImage?: boolean
      supportsReferenceVideo?: boolean
      type: "image" | "video" | "audio" | "upscale"
    }>
    total?: number
    type?: "image" | "video" | "audio" | "upscale" | null
  }
  errorText?: string
}

type SearchAssetsToolPart = {
  type: "tool-searchAssets"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    assetType?: "image" | "video" | "audio"
    category?: "character" | "scene" | "texture" | "thumbnails" | "motion" | "audio" | "shorts" | "product"
    includePublic?: boolean
    limit?: number
    query?: string
  }
  output?: {
    assets?: Array<{
      assetType: "image" | "video" | "audio"
      category: string
      description?: string | null
      id: string
      tags: string[]
      thumbnailUrl?: string | null
      title: string
      url: string
      visibility: "private" | "public"
    }>
    message?: string
    query?: string | null
    total?: number
  }
  errorText?: string
}

type ListRecentGenerationsToolPart = {
  type: "tool-listRecentGenerations"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    includePending?: boolean
    limit?: number
    query?: string
    type?: "image" | "video" | "audio"
  }
  output?: {
    generations?: Array<{
      aspectRatio?: string | null
      createdAt: string
      errorMessage?: string | null
      id: string
      linkedAsset?: {
        id: string
        title: string
        visibility: "private" | "public"
      } | null
      model?: string | null
      predictionId?: string | null
      prompt?: string | null
      status: "pending" | "completed" | "failed"
      tool?: string | null
      type: "image" | "video" | "audio"
      url?: string | null
    }>
    message?: string
    query?: string | null
    total?: number
    type?: "image" | "video" | "audio" | null
  }
  errorText?: string
}

type ListThreadMediaToolPart = {
  type: "tool-listThreadMedia"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    limit?: number
    mediaKind?: "user_upload" | "generation" | "all"
  }
  output?: {
    threadId?: string
    count?: number
    items?: Array<{
      id: string
      mediaKind: "user_upload" | "generation"
      mimeType: string
      label: string
      publicUrl: string
      createdAt: string
    }>
  }
  errorText?: string
}

type ExtractVideoFramesToolPart = {
  type: "tool-extractVideoFrames"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    assetId?: string
    evenlySpacedInteriorCount?: number
    extraTimestampsSec?: number[]
    includeFirst?: boolean
    includeLast?: boolean
    maxEdgePx?: number
    mediaId?: string
    outputFormat?: "jpeg" | "png"
    persistToThread?: boolean
  }
  output?: {
    frameCount?: number
    frames?: Array<{
      kind: string
      label: string
      mediaId?: string
      mimeType: string
      publicUrl: string
      timestampSec: number
    }>
    note?: string
    persistedToThread?: boolean
    videoDurationSec?: number
  }
  errorText?: string
}

type ComposeTimelineVideoToolPart = {
  type: "tool-composeTimelineVideo"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    fps?: number
    outputPreset?: string
    segments?: Array<{
      durationSeconds?: number
      mediaId: string
      trimEndSeconds?: number
      trimStartSeconds?: number
    }>
  }
  output?: {
    creditsUsed?: number
    fps?: number
    height?: number
    message?: string
    outputPreset?: string
    segmentCount?: number
    status?: "completed"
    video?: {
      mimeType?: string
      storagePath?: string | null
      url: string
    }
    videoDurationSec?: number
    width?: number
  }
  errorText?: string
}

type SaveGenerationAsAssetToolPart = {
  type: "tool-saveGenerationAsAsset"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    category?: "character" | "scene" | "texture" | "thumbnails" | "motion" | "audio" | "shorts" | "product"
    confirmed?: boolean
    description?: string
    generationId?: string
    title?: string
    visibility?: "private" | "public"
  }
  output?: {
    alreadySaved?: boolean
    asset?: {
      assetType: "image" | "video" | "audio"
      category: string
      description?: string | null
      id: string
      sourceGenerationId?: string | null
      tags: string[]
      thumbnailUrl?: string | null
      title: string
      url: string
      visibility: "private" | "public"
    }
    message?: string
  }
  errorText?: string
}

type GetBrandContextToolPart = {
  type: "tool-getBrandContext"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    brandName?: string
  }
  output?: {
    status?: "resolved" | "needs-clarification" | "no-brand-kits" | "no-match" | "empty-brand-kit"
    message?: string
    defaultBrand?: string | null
    brand?: {
      id: string
      iconUrl?: string | null
      isDefault: boolean
      name: string
      websiteUrl?: string | null
    }
    availableBrands?: Array<{
      id: string
      iconUrl?: string | null
      isDefault: boolean
      name: string
      websiteUrl?: string | null
    }>
  }
  errorText?: string
}

export type InstagramConnectionToolSummary = {
  accountType?: string | null
  id: string
  instagramUserId?: string | null
  instagramUsername?: string | null
  profileFetchedAt?: string | null
  tokenExpiresAt?: string | null
  updatedAt: string
}

type ListInstagramConnectionsToolPart = {
  type: "tool-listInstagramConnections"
  toolCallId: string
  state:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "approval-responded"
    | "output-available"
    | "output-error"
    | "output-denied"
  output?: {
    connections?: InstagramConnectionToolSummary[]
    message?: string
    total?: number
  }
  errorText?: string
}

type PrepareInstagramPostToolInput = {
  action: "draft" | "schedule"
  caption?: string
  carouselItems?: Array<{
    kind: "image" | "video"
    url: string
  }>
  coverUrl?: string
  instagramConnectionId: string
  mediaType: "image" | "feed_video" | "reel" | "carousel" | "story"
  mediaUrl?: string
  scheduledAt?: string
  shareToFeed?: boolean
  storyAssetKind?: "image" | "video"
  trialParams?: {
    graduationStrategy: "MANUAL" | "SS_PERFORMANCE"
  }
}

type PrepareInstagramPostToolPart = {
  type: "tool-prepareInstagramPost"
  toolCallId: string
  state:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "approval-responded"
    | "output-available"
    | "output-error"
    | "output-denied"
  input?: PrepareInstagramPostToolInput
  output?: {
    action: "draft" | "schedule"
    instagramAccount?: InstagramConnectionToolSummary
    message?: string
    post?: {
      caption?: string | null
      createdAt: string
      id: string
      instagramConnectionId: string
      mediaType: "image" | "feed_video" | "reel" | "carousel" | "story"
      mediaUrl: string
      metadata?: {
        assetKind?: "image" | "video"
        carouselItems?: Array<{
          kind: "image" | "video"
          url: string
        }>
      } | null
      scheduledAt?: string | null
      status: string
    }
  }
  approval?: {
    approved?: boolean
    id: string
    reason?: string
  }
  errorText?: string
}

type SaveSkillToolPart = {
  type: "tool-saveSkill"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    description?: string
    instructionsBody?: string
    slug?: string
    title?: string
  }
  output?: {
    message?: string
    slug?: string
    status?: "error" | "saved"
  }
  errorText?: string
}

type ActivateSkillToolPart = {
  type: "tool-activateSkill"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    slug?: string
  }
  output?: {
    message?: string
    name?: string
    slug?: string
    status?: "not-found" | "ok" | "parse-error"
    title?: string | null
  }
  errorText?: string
}

type AwaitGenerationToolPart = {
  type: "tool-awaitGeneration"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    generationId?: string
    maxWaitSeconds?: number
    pollIntervalSeconds?: number
    predictionId?: string
  }
  output?: {
    error?: string
    generationId?: string
    kind?: "image" | "video"
    lastStatus?: "completed" | "failed" | "pending"
    mediaId?: string
    message?: string
    mimeType?: string
    status?: "completed" | "failed" | "timeout"
    url?: string
  }
  errorText?: string
}

type ScheduleGenerationFollowUpToolPart = {
  type: "tool-scheduleGenerationFollowUp"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    generationId?: string
    plan?: string
  }
  output?: {
    error?: string
    generationId?: string
    message?: string
    status?: "failed" | "scheduled"
  }
  errorText?: string
}

type ComposerUploadAttachment = {
  file: File
  id: string
  isUploading: boolean
  source: "upload"
  uploadedUrl?: string
}

type ComposerAssetAttachment = {
  assetType: "image" | "video" | "audio"
  id: string
  ref: AttachedRef
  source: "asset"
  title: string
  url: string
}

type ComposerAttachment = ComposerUploadAttachment | ComposerAssetAttachment

const EMPTY_MESSAGES: UIMessage[] = []

const REACTFLOW_NODE_MIME = "application/reactflow-node"

function composerDropTypesAccept(dt: DataTransfer): boolean {
  const types = Array.from(dt.types ?? [])
  return types.includes("Files") || types.includes(REACTFLOW_NODE_MIME)
}

function attachedRefFromDroppedMediaUrl(url: string, assetType: "image" | "video" | "audio"): AttachedRef {
  const chipId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const label =
    assetType === "image" ? "Reference image" : assetType === "video" ? "Reference video" : "Reference audio"
  return {
    id: chipId,
    label,
    category: "asset",
    assetType,
    assetUrl: url,
    previewUrl: url,
    serialized: `Reference (${assetType}) "${label}": ${url}`,
    chipId,
    mentionToken: "",
  }
}

function inferMediaTypeFromFile(file: File): MediaValueType {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("audio/")) return "audio"
  const lower = file.name.toLowerCase()
  if (IMAGE_FILENAME_EXT.test(lower)) return "image"
  if (VIDEO_FILENAME_EXT.test(lower)) return "video"
  if (AUDIO_FILENAME_EXT.test(lower)) return "audio"
  return "other"
}

function inferMediaTypeFromAssetType(assetType: ComposerAssetAttachment["assetType"]): MediaValueType {
  return assetType
}

function normalizeUrlCandidate(url: string): string | null {
  const trimmed = url.trim().replace(/[),.;!?]+$/, "")
  if (!trimmed) return null
  return trimmed
}

function isImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return IMAGE_FILENAME_EXT.test(parsed.pathname)
  } catch {
    return IMAGE_FILENAME_EXT.test(url)
  }
}

function extractInlineImageUrlsFromText(text: string): string[] {
  const imageUrls = new Set<string>()
  const markdownImageUrls = new Set<string>()

  for (const match of text.matchAll(MARKDOWN_IMAGE_URL_REGEX)) {
    const url = normalizeUrlCandidate(match[1] ?? "")
    if (url) {
      markdownImageUrls.add(url)
    }
  }

  for (const match of text.matchAll(MARKDOWN_LINK_URL_REGEX)) {
    const url = normalizeUrlCandidate(match[1] ?? "")
    if (url && !markdownImageUrls.has(url) && isImageUrl(url)) {
      imageUrls.add(url)
    }
  }

  for (const match of text.matchAll(RAW_URL_REGEX)) {
    const url = normalizeUrlCandidate(match[0] ?? "")
    if (url && !markdownImageUrls.has(url) && isImageUrl(url)) {
      imageUrls.add(url)
    }
  }

  return Array.from(imageUrls)
}

function fallbackMediaTypeForAssetType(assetType: ComposerAssetAttachment["assetType"]) {
  if (assetType === "video") return "video/mp4"
  if (assetType === "audio") return "audio/mpeg"
  return "image/png"
}

function useAttachmentObjectUrls(attachments: ComposerAttachment[]) {
  const [urls, setUrls] = React.useState<string[]>([])

  React.useLayoutEffect(() => {
    const objectUrls: string[] = []
    const next = attachments.map((attachment) => {
      if (attachment.source === "asset") {
        return attachment.url
      }

      const url = URL.createObjectURL(attachment.file)
      objectUrls.push(url)
      return url
    })
    setUrls(next)
    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [attachments])

  return urls
}

const COMPOSER_THUMB_BOX =
  "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40"
const COMPOSER_THUMB_MEDIA = "h-full w-full object-cover"

function ComposerAttachmentPreviews({
  attachments,
  onRemove,
}: {
  attachments: ComposerAttachment[]
  onRemove: (attachment: ComposerAttachment) => void
}) {
  const urls = useAttachmentObjectUrls(attachments)

  if (attachments.length === 0) return null

  return (
    <div className="flex flex-row flex-wrap items-start gap-2">
      {attachments.map((attachment, index) => {
        const isUpload = attachment.source === "upload"
        const isUploading = isUpload ? attachment.isUploading : false
        const title = isUpload ? attachment.file.name : attachment.title
        const url = urls[index]
        const mediaType = isUpload
          ? inferMediaTypeFromFile(attachment.file)
          : inferMediaTypeFromAssetType(attachment.assetType)

        return (
          <div key={attachment.id} className="relative shrink-0">
            {mediaType === "image" ? (
              <div className={COMPOSER_THUMB_BOX} title={title}>
                {url ? (
                  <img src={url} alt="" className={COMPOSER_THUMB_MEDIA} />
                ) : (
                  <div className="h-full w-full animate-pulse bg-muted" aria-hidden />
                )}
              </div>
            ) : mediaType === "video" ? (
              <div className={COMPOSER_THUMB_BOX} title={title}>
                {url ? (
                  <video
                    src={url}
                    muted
                    playsInline
                    className={COMPOSER_THUMB_MEDIA}
                    aria-label={title}
                  />
                ) : (
                  <div className="h-full w-full animate-pulse bg-muted" aria-hidden />
                )}
              </div>
            ) : mediaType === "audio" ? (
              <div
                className="relative flex h-16 w-[min(100%,200px)] min-w-[160px] max-w-[220px] shrink-0 items-center rounded-lg border border-border bg-muted/40 px-2 py-1"
                title={title}
              >
                {url ? (
                  <audio src={url} controls className="h-8 w-full" />
                ) : (
                  <div className="h-8 w-full animate-pulse rounded bg-muted" aria-hidden />
                )}
              </div>
            ) : (
              <Badge variant="outline" className="max-w-[200px] shrink-0 truncate" title={title}>
                {title}
              </Badge>
            )}
            {isUploading ? (
              <span className="absolute bottom-1 left-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
                Uploading...
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onRemove(attachment)}
              className="absolute -top-1.5 -right-1.5 z-10 rounded-full border border-border bg-background p-1 shadow-sm hover:bg-destructive hover:text-destructive-foreground"
              aria-label={`Remove ${title}`}
            >
              <X className="size-3" weight="bold" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

async function filesToMessageParts(attachments: ComposerAttachment[] | undefined): Promise<UIMessage["parts"]> {
  if (!attachments || attachments.length === 0) return []

  const parts = await Promise.all(
    attachments.map(
      (attachment) =>
        new Promise<UIMessage["parts"][number]>((resolve, reject) => {
          if (attachment.source === "asset") {
            resolve({
              type: "file",
              url: attachment.url,
              mediaType: fallbackMediaTypeForAssetType(attachment.assetType),
              filename: attachment.title,
            })
            return
          }

          const { file, uploadedUrl } = attachment

          if (uploadedUrl) {
            resolve({
              type: "file",
              url: uploadedUrl,
              mediaType: file.type,
              filename: file.name,
            })
            return
          }

          const reader = new FileReader()
          reader.onload = () => {
            resolve({
              type: "file",
              url: reader.result as string,
              mediaType: file.type,
              filename: file.name,
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        }),
    ),
  )

  return parts
}

function brandReferencesOnly(refs: ChatReferenceMetadataItem[]) {
  return refs.filter((ref) => ref.category === "brand")
}

function ChatBrandPills({
  refs,
  onRemove,
}: {
  refs: ChatReferenceMetadataItem[]
  onRemove?: (id: string) => void
}) {
  const brandRefs = brandReferencesOnly(refs)
  if (brandRefs.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5" role="list" aria-label="Attached brand context">
      {brandRefs.map((ref) => (
        <span
          key={ref.id}
          role="listitem"
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-foreground"
        >
          <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-background">
            {ref.previewUrl ? (
              <img src={ref.previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Palette className="size-3 text-primary" weight="duotone" aria-hidden />
            )}
          </span>
          <span className="truncate font-medium">{ref.label}</span>
          {onRemove ? (
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground"
              onClick={() => onRemove(ref.id)}
              aria-label={`Remove ${ref.label}`}
            >
              <X className="size-3" weight="bold" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  )
}

function formatCredits(value: number): string {
  if (!Number.isFinite(value)) return "0"
  if (value === 0) return "0"
  if (value >= 1) return value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)
  if (value >= 0.01) return value.toFixed(3)
  return value.toFixed(4)
}

function CreditCostBadge({
  modelIdentifier,
  variantCount = 1,
  actualCredits,
}: {
  modelIdentifier?: string | null
  variantCount?: number | null
  actualCredits?: number | null
}) {
  if (typeof actualCredits === "number" && actualCredits > 0) {
    return <Badge variant="outline">{formatCredits(actualCredits)} credits</Badge>
  }
  if (!modelIdentifier) return null
  const perImageCost = getModelMetadataCost(modelIdentifier)
  if (!perImageCost) return null
  const variants = variantCount && variantCount > 0 ? variantCount : 1
  const estimated = perImageCost * variants
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="cursor-help">
          ~{formatCredits(estimated)} credits
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left">
        Estimated cost: {formatCredits(perImageCost)} credits per image × {variants} variation
        {variants === 1 ? "" : "s"}. Final cost shown once generation completes.
      </TooltipContent>
    </Tooltip>
  )
}

function PromptLengthBadge({ prompt }: { prompt?: string | null }) {
  if (!prompt) return null
  const length = prompt.length
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="cursor-help">
          prompt: {length} {length === 1 ? "char" : "chars"}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm whitespace-pre-wrap wrap-break-word text-left">
        {prompt}
      </TooltipContent>
    </Tooltip>
  )
}

function ImageGenerationResultCard({
  badgeLabel,
  messageId,
  modelFallback,
  part,
  title,
}: {
  badgeLabel: string
  messageId: string
  modelFallback: string
  part: GenerateImageToolPart | UniversalGenerateImageToolPart
  title: string
}) {
  const [polledState, setPolledState] = React.useState<{
    error?: string
    generationId?: string
    images?: Array<{
      mimeType?: string
      url: string
    }>
    status: "pending" | "completed" | "failed"
  } | null>(null)

  React.useEffect(() => {
    if (part.state !== "output-available") return
    if (part.output?.status !== "pending") return
    if (!part.output?.predictionId) return

    let cancelled = false

    const poll = async () => {
      for (let attempt = 0; attempt < 180; attempt += 1) {
        try {
          const response = await fetch(
            `/api/generate-image/status?predictionId=${encodeURIComponent(part.output?.predictionId ?? "")}`,
            { cache: "no-store" },
          )

          if (!response.ok) {
            if (!cancelled && (response.status === 401 || response.status === 403 || response.status >= 500)) {
              setPolledState({
                error: "Failed to fetch image status.",
                status: "failed",
              })
            }
            if (response.status === 404) {
              continue
            }
            return
          }

          const data = await response.json()
          if (cancelled) return

          if (data.status === "completed") {
            const images = Array.isArray(data.images)
              ? data.images
              : data.image?.url
                ? [data.image]
                : []

            if (images.length === 0) {
              setPolledState({
                error: "Image generation completed without any returned images.",
                generationId: data.generationId,
                status: "failed",
              })
              return
            }

            setPolledState({
              generationId: data.generationId,
              images,
              status: "completed",
            })
            return
          }

          if (data.status === "failed") {
            setPolledState({
              error: data.error || "Image generation failed.",
              generationId: data.generationId,
              status: "failed",
            })
            return
          }
        } catch {
          if (!cancelled) {
            setPolledState({
              error: "Failed to fetch image status.",
              status: "failed",
            })
          }
          return
        }

        await new Promise((resolve) => setTimeout(resolve, 5000))
        if (cancelled) return
      }

      if (!cancelled) {
        setPolledState({
          error: "Image generation timed out while waiting for completion.",
          status: "failed",
        })
      }
    }

    void poll()

    return () => {
      cancelled = true
    }
  }, [part.output?.predictionId, part.output?.status, part.state])

  if (part.state === "input-streaming") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" />
          Preparing image generation...
        </CardContent>
      </Card>
    )
  }

  if (part.state === "input-available") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">Starting image generation</p>
            </div>
            <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
          <p className="text-sm leading-6 text-foreground">{part.input?.prompt}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{part.input?.modelIdentifier || modelFallback}</Badge>
            <Badge variant="outline">{part.input?.aspectRatio || "1:1"}</Badge>
            <Badge variant="outline">
              {part.input?.variantCount || 1} variation
              {(part.input?.variantCount || 1) > 1 ? "s" : ""}
            </Badge>
            <CreditCostBadge
              modelIdentifier={part.input?.modelIdentifier ?? modelFallback}
              variantCount={part.input?.variantCount ?? 1}
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-error") {
    return (
      <Card key={messageId} className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-2 p-4 text-sm text-destructive">
          <p className="font-medium">{title} failed</p>
          <p>{part.errorText || "Unknown tool error."}</p>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-available") {
    const effectiveStatus = polledState?.status ?? part.output?.status ?? "completed"
    const effectiveImages = polledState?.images ?? part.output?.images ?? []
    const effectiveGenerationId = polledState?.generationId ?? part.output?.generationId
    const creditsUsed =
      part.output && "creditsUsed" in part.output
        ? (part.output as UniversalGenerateImageToolPart["output"])?.creditsUsed
        : undefined

    if (effectiveStatus === "failed") {
      return (
        <Card key={messageId} className="border-destructive/30 bg-destructive/5">
          <CardContent className="space-y-2 p-4 text-sm text-destructive">
            <p className="font-medium">{title} failed</p>
            <p>{polledState?.error || part.errorText || "Unknown tool error."}</p>
          </CardContent>
        </Card>
      )
    }

    if (effectiveStatus === "pending") {
      return (
        <Card key={messageId} className="border-border/60 bg-muted/10">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Image Pending</Badge>
              <Badge variant="outline">{part.output?.model || modelFallback}</Badge>
              <Badge variant="outline">{part.output?.aspectRatio || part.input?.aspectRatio || "1:1"}</Badge>
              <Badge variant="outline">
                {part.output?.usedReferenceCount || 0} reference
                {(part.output?.usedReferenceCount || 0) === 1 ? "" : "s"}
              </Badge>
              <CreditCostBadge
                modelIdentifier={part.input?.modelIdentifier ?? part.output?.model ?? modelFallback}
                variantCount={part.input?.variantCount ?? 1}
              />
              <PromptLengthBadge prompt={part.input?.prompt} />
            </div>
            {part.output?.message ? (
              <p className="text-sm text-muted-foreground">{part.output.message}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <CircleNotch className="h-4 w-4 animate-spin" />
              <span>Image generation is still running.</span>
              {effectiveGenerationId ? <Badge variant="outline">job {effectiveGenerationId.slice(0, 8)}</Badge> : null}
            </div>
          </CardContent>
        </Card>
      )
    }

    const imageGridImages = effectiveImages.map((image) => ({
      url: image.url,
      model: part.output?.model ?? modelFallback,
      prompt: part.input?.prompt ?? null,
      tool: "image",
      aspectRatio: part.output?.aspectRatio ?? "1:1",
    }))

    return (
      <Card key={messageId} className="border-border/60 bg-muted/10">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{badgeLabel}</Badge>
            <Badge variant="outline">{part.output?.model || modelFallback}</Badge>
            <Badge variant="outline">{part.output?.aspectRatio || "1:1"}</Badge>
            <Badge variant="outline">
              {part.output?.usedReferenceCount || 0} reference
              {(part.output?.usedReferenceCount || 0) === 1 ? "" : "s"}
            </Badge>
            <CreditCostBadge
              modelIdentifier={part.input?.modelIdentifier ?? part.output?.model ?? modelFallback}
              variantCount={part.input?.variantCount ?? 1}
              actualCredits={creditsUsed}
            />
            <PromptLengthBadge prompt={part.input?.prompt} />
          </div>
          {part.output?.message ? (
            <p className="text-sm text-muted-foreground">{part.output.message}</p>
          ) : null}
          {effectiveImages.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
              <ImageGrid images={imageGridImages} className="h-auto" basicActionsOnly initialColumnCount={1} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return null
}

function VideoGenerationResultCard({
  messageId,
  part,
}: {
  messageId: string
  part: GenerateVideoToolPart
}) {
  const [polledState, setPolledState] = React.useState<{
    error?: string
    generationId?: string
    status: "pending" | "completed" | "failed"
    video?: {
      mimeType?: string
      url: string
    }
  } | null>(null)

  React.useEffect(() => {
    if (part.state !== "output-available") return
    if (part.output?.status !== "pending") return
    if (!part.output?.predictionId) return

    let cancelled = false

    const poll = async () => {
      for (let attempt = 0; attempt < 180; attempt += 1) {
        try {
          const response = await fetch(
            `/api/generate-video/status?predictionId=${encodeURIComponent(part.output?.predictionId ?? "")}`,
            { cache: "no-store" },
          )

          if (!response.ok) {
            if (!cancelled && (response.status === 401 || response.status === 403 || response.status >= 500)) {
              setPolledState({
                error: "Failed to fetch video status.",
                status: "failed",
              })
            }
            if (response.status === 404) {
              continue
            }
            return
          }

          const data = await response.json()
          if (cancelled) return

          if (data.status === "completed") {
            setPolledState({
              generationId: data.generationId,
              status: "completed",
              video: data.video,
            })
            return
          }

          if (data.status === "failed") {
            setPolledState({
              error: data.error || "Video generation failed.",
              generationId: data.generationId,
              status: "failed",
            })
            return
          }
        } catch {
          if (!cancelled) {
            setPolledState({
              error: "Failed to fetch video status.",
              status: "failed",
            })
          }
          return
        }

        await new Promise((resolve) => setTimeout(resolve, 5000))
        if (cancelled) return
      }

      if (!cancelled) {
        setPolledState({
          error: "Video generation timed out while waiting for completion.",
          status: "failed",
        })
      }
    }

    void poll()

    return () => {
      cancelled = true
    }
  }, [part.output?.predictionId, part.output?.status, part.state])

  if (part.state === "input-streaming") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" />
          Preparing video generation...
        </CardContent>
      </Card>
    )
  }

  if (part.state === "input-available") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Video Generation Tool</p>
              <p className="text-xs text-muted-foreground">Starting video generation</p>
            </div>
            <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
          {part.input?.prompt ? (
            <p className="text-sm leading-6 text-foreground">{part.input.prompt}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Using attached references to generate video.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{part.input?.modelIdentifier || "auto"}</Badge>
            {part.input?.aspectRatio ? <Badge variant="outline">{part.input.aspectRatio}</Badge> : null}
            {typeof part.input?.duration === "number" ? (
              <Badge variant="outline">{part.input.duration}s</Badge>
            ) : null}
            {part.input?.mode ? <Badge variant="outline">{part.input.mode}</Badge> : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-error") {
    return (
      <Card key={messageId} className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-2 p-4 text-sm text-destructive">
          <p className="font-medium">Video generation failed</p>
          <p>{part.errorText || "Unknown tool error."}</p>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-available") {
    const effectiveStatus = polledState?.status ?? part.output?.status ?? "completed"
    const effectiveVideo = polledState?.video ?? part.output?.video
    const effectiveGenerationId = polledState?.generationId ?? part.output?.generationId

    if (effectiveStatus === "failed") {
      return (
        <Card key={messageId} className="border-destructive/30 bg-destructive/5">
          <CardContent className="space-y-2 p-4 text-sm text-destructive">
            <p className="font-medium">Video generation failed</p>
            <p>{polledState?.error || part.errorText || "Unknown tool error."}</p>
          </CardContent>
        </Card>
      )
    }

    if (effectiveStatus === "pending") {
      return (
        <Card key={messageId} className="border-border/60 bg-muted/10">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Video Pending</Badge>
              {part.output?.model ? <Badge variant="outline">{part.output.model}</Badge> : null}
              <Badge variant="outline">
                {part.output?.usedImageReferenceCount || 0} image ref
                {(part.output?.usedImageReferenceCount || 0) === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline">
                {part.output?.usedVideoReferenceCount || 0} video ref
                {(part.output?.usedVideoReferenceCount || 0) === 1 ? "" : "s"}
              </Badge>
              {(part.output?.usedAudioReferenceCount ?? 0) > 0 ? (
                <Badge variant="outline">
                  {part.output?.usedAudioReferenceCount} audio ref
                  {(part.output?.usedAudioReferenceCount ?? 0) === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
            {part.output?.message ? (
              <p className="text-sm text-muted-foreground">{part.output.message}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <CircleNotch className="h-4 w-4 animate-spin" />
              <span>Video generation is still running.</span>
              {effectiveGenerationId ? <Badge variant="outline">job {effectiveGenerationId.slice(0, 8)}</Badge> : null}
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card key={messageId} className="border-border/60 bg-muted/10">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Generated Video</Badge>
            {part.output?.model ? <Badge variant="outline">{part.output.model}</Badge> : null}
            <Badge variant="outline">
              {part.output?.usedImageReferenceCount || 0} image ref
              {(part.output?.usedImageReferenceCount || 0) === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline">
              {part.output?.usedVideoReferenceCount || 0} video ref
              {(part.output?.usedVideoReferenceCount || 0) === 1 ? "" : "s"}
            </Badge>
            {(part.output?.usedAudioReferenceCount ?? 0) > 0 ? (
              <Badge variant="outline">
                {part.output?.usedAudioReferenceCount} audio ref
                {(part.output?.usedAudioReferenceCount ?? 0) === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
          {part.output?.message ? (
            <p className="text-sm text-muted-foreground">{part.output.message}</p>
          ) : null}
          {effectiveVideo?.url ? (
            <video
              src={effectiveVideo.url}
              controls
              playsInline
              className="max-h-[420px] w-full rounded-2xl border border-border/60 bg-black"
            />
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return null
}

function formatInstagramSchedule(value?: string | null) {
  if (!value) return null

  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function InstagramMediaPreview({
  input,
}: {
  input?: PrepareInstagramPostToolInput
}) {
  if (!input) {
    return null
  }

  const items =
    input.mediaType === "carousel"
      ? input.carouselItems ?? []
      : input.mediaUrl
        ? [{ kind: input.mediaType === "image" ? "image" : "video", url: input.mediaUrl }]
        : []

  if (items.length === 0) {
    return null
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.slice(0, 4).map((item, index) =>
        item.kind === "image" ? (
          <img
            key={`${item.url}-${index}`}
            src={item.url}
            alt=""
            className="max-h-48 w-full rounded-xl border border-border/60 object-cover"
          />
        ) : (
          <video
            key={`${item.url}-${index}`}
            src={item.url}
            controls
            className="max-h-48 w-full rounded-xl border border-border/60 bg-black"
          />
        ),
      )}
    </div>
  )
}

export function MessageParts({
  message,
  instagramConnectionsById,
  onToolApprovalResponse,
}: {
  message: UIMessage
  instagramConnectionsById: Map<string, InstagramConnectionToolSummary>
  onToolApprovalResponse: (approvalId: string, approved: boolean) => void
}) {
  return (
    <>
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          const inlineImageUrls = extractInlineImageUrlsFromText(part.text)
          return (
            <div key={`${message.id}-${index}`} className="space-y-3">
              <MessageResponse>
                {part.text}
              </MessageResponse>
              {inlineImageUrls.map((url) => (
                <img
                  key={`${message.id}-${index}-${url}`}
                  src={url}
                  alt=""
                  className="max-h-[480px] w-full rounded-xl border border-border/60 object-contain"
                  loading="lazy"
                />
              ))}
            </div>
          )
        }

        if (part.type === "file") {
          if (part.mediaType?.startsWith("image/")) {
            return (
              <img
                key={`${message.id}-${index}`}
                src={part.url}
                alt={part.filename || "Attachment"}
                className="my-2 max-h-72 rounded-2xl border border-border/60 object-contain"
              />
            )
          }

          if (part.mediaType?.startsWith("video/")) {
            return (
              <video
                key={`${message.id}-${index}`}
                src={part.url}
                controls
                className="my-2 max-h-72 rounded-2xl border border-border/60 bg-black"
              />
            )
          }

          if (part.mediaType?.startsWith("audio/")) {
            return (
              <audio
                key={`${message.id}-${index}`}
                src={part.url}
                controls
                className="my-2 w-full"
              />
            )
          }
        }

        if (part.type === "tool-generateImageWithNanoBanana") {
          const toolPart = part as GenerateImageToolPart
          return (
            <ImageGenerationResultCard
              key={`${message.id}-${index}`}
              badgeLabel="Generated"
              messageId={`${message.id}-${index}`}
              modelFallback="google/nano-banana-2"
              part={toolPart}
              title="Nano Banana Tool"
            />
          )
        }

        if (part.type === "tool-generateImage") {
          const toolPart = part as UniversalGenerateImageToolPart
          return (
            <ImageGenerationResultCard
              key={`${message.id}-${index}`}
              badgeLabel="Generated"
              messageId={`${message.id}-${index}`}
              modelFallback="google/nano-banana-2"
              part={toolPart}
              title="Image Generation Tool"
            />
          )
        }

        if (part.type === "tool-generateVideo") {
          const toolPart = part as GenerateVideoToolPart
          return <VideoGenerationResultCard key={`${message.id}-${index}`} messageId={`${message.id}-${index}`} part={toolPart} />
        }

        if (part.type === "tool-extractVideoFrames") {
          const toolPart = part as ExtractVideoFramesToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Extracting video frames</p>
                    <p className="truncate text-xs text-muted-foreground">Sampling your clip with ffmpeg</p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Frame extraction failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const frames = toolPart.output?.frames ?? []
          const imageGridImages = frames.map((frame) => ({
            id: frame.mediaId,
            url: frame.publicUrl,
            model: "extractVideoFrames",
            prompt: frame.label,
            tool: "extractVideoFrames",
            aspectRatio: null as string | null,
          }))

          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Video frames</Badge>
                  {typeof toolPart.output?.frameCount === "number" ? (
                    <Badge variant="outline">
                      {toolPart.output.frameCount} frame{toolPart.output.frameCount === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                  {typeof toolPart.output?.videoDurationSec === "number" ? (
                    <Badge variant="outline">{toolPart.output.videoDurationSec.toFixed(2)}s clip</Badge>
                  ) : null}
                  {toolPart.output?.persistedToThread ? (
                    <Badge variant="outline">On thread</Badge>
                  ) : (
                    <Badge variant="outline">Ephemeral</Badge>
                  )}
                </div>
                {toolPart.output?.note ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.note}</p>
                ) : null}
                {imageGridImages.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
                    <ImageGrid images={imageGridImages} className="h-auto" basicActionsOnly initialColumnCount={1} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No frames returned.</p>
                )}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-composeTimelineVideo") {
          const toolPart = part as ComposeTimelineVideoToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Composing timeline video</p>
                    <p className="truncate text-xs text-muted-foreground">Stitching segments with ffmpeg</p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Timeline composition failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const v = toolPart.output?.video
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Composed video</Badge>
                  {toolPart.output?.outputPreset ? (
                    <Badge variant="outline">{toolPart.output.outputPreset}</Badge>
                  ) : null}
                  {typeof toolPart.output?.segmentCount === "number" ? (
                    <Badge variant="outline">
                      {toolPart.output.segmentCount} segment{toolPart.output.segmentCount === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                  {typeof toolPart.output?.videoDurationSec === "number" ? (
                    <Badge variant="outline">{toolPart.output.videoDurationSec.toFixed(2)}s</Badge>
                  ) : null}
                  {typeof toolPart.output?.creditsUsed === "number" ? (
                    <Badge variant="outline">{toolPart.output.creditsUsed} credits</Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {v?.url ? (
                  <video
                    src={v.url}
                    controls
                    playsInline
                    className="max-h-[420px] w-full rounded-2xl border border-border/60 bg-black"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No video URL returned.</p>
                )}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-listInstagramConnections") {
          const toolPart = part as unknown as ListInstagramConnectionsToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Checking Instagram connections</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Looking up connected Instagram accounts
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Instagram account lookup failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const connections = toolPart.output?.connections ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Instagram Accounts</Badge>
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">
                      {toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                <div className="space-y-2">
                  {connections.map((connection) => (
                    <div
                      key={connection.id}
                      className="rounded-xl border border-border/60 bg-background/80 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {connection.instagramUsername || "Unnamed Instagram account"}
                        </p>
                        {connection.accountType ? (
                          <Badge variant="outline">{connection.accountType}</Badge>
                        ) : null}
                        <Badge variant="outline">{connection.id.slice(0, 8)}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>Updated {new Date(connection.updatedAt).toLocaleString()}</span>
                        {connection.tokenExpiresAt ? (
                          <span>Token expires {new Date(connection.tokenExpiresAt).toLocaleString()}</span>
                        ) : null}
                        {connection.profileFetchedAt ? (
                          <span>Profile fetched {new Date(connection.profileFetchedAt).toLocaleString()}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-prepareInstagramPost") {
          const toolPart = part as unknown as PrepareInstagramPostToolPart
          const resolvedAccount = toolPart.output?.instagramAccount
            ?? (toolPart.input
              ? instagramConnectionsById.get(toolPart.input.instagramConnectionId)
              : undefined)
          const scheduleLabel =
            formatInstagramSchedule(toolPart.output?.post?.scheduledAt)
            ?? formatInstagramSchedule(toolPart.input?.scheduledAt)

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Preparing Instagram post</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Building the post summary for approval
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "approval-requested") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Instagram Approval</Badge>
                    {toolPart.input?.action ? <Badge variant="outline">{toolPart.input.action}</Badge> : null}
                    {toolPart.input?.mediaType ? <Badge variant="outline">{toolPart.input.mediaType}</Badge> : null}
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      {resolvedAccount?.instagramUsername || toolPart.input?.instagramConnectionId || "Instagram account"}
                    </p>
                    <p className="text-muted-foreground">
                      {toolPart.input?.action === "schedule"
                        ? `Schedule this post${scheduleLabel ? ` for ${scheduleLabel}` : ""}?`
                        : "Save this post as a draft?"}
                    </p>
                  </div>
                  {toolPart.input?.caption ? (
                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caption</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                        {toolPart.input.caption}
                      </p>
                    </div>
                  ) : null}
                  <InstagramMediaPreview input={toolPart.input} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => toolPart.approval?.id && onToolApprovalResponse(toolPart.approval.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toolPart.approval?.id && onToolApprovalResponse(toolPart.approval.id, false)}
                    >
                      Deny
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "approval-responded") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Processing approval</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.approval?.approved ? "Finishing the Instagram post request" : "Recording the denial"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-denied") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
                <CardContent className="space-y-2 p-4 text-sm">
                  <p className="font-medium">Instagram post not created</p>
                  <p className="text-muted-foreground">The approval request was denied, so no post was saved.</p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Instagram post failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{toolPart.output?.post?.status === "queued" ? "Instagram Scheduled" : "Instagram Draft"}</Badge>
                  {toolPart.output?.post?.mediaType ? <Badge variant="outline">{toolPart.output.post.mediaType}</Badge> : null}
                  {resolvedAccount?.instagramUsername ? (
                    <Badge variant="outline">{resolvedAccount.instagramUsername}</Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {toolPart.output?.post ? (
                  <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Job {toolPart.output.post.id.slice(0, 8)}</span>
                      <span>Created {new Date(toolPart.output.post.createdAt).toLocaleString()}</span>
                      {scheduleLabel ? <span>Scheduled {scheduleLabel}</span> : null}
                    </div>
                    {toolPart.output.post.caption ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                        {toolPart.output.post.caption}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <InstagramMediaPreview input={toolPart.input} />
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-searchModels") {
          const toolPart = part as SearchModelsToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Loading models</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.input?.type
                        ? `Listing ${toolPart.input.type} models`
                        : "Listing all active models"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Model list failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const models = toolPart.output?.models ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Models</Badge>
                  {toolPart.output?.type ? <Badge variant="outline">{toolPart.output.type}</Badge> : null}
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">{toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}</Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {models.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="model-results" className="border border-border/60 rounded-xl bg-background/70 px-3">
                      <AccordionTrigger className="py-3 text-sm hover:no-underline">
                        <span className="flex flex-wrap items-center gap-2 text-left">
                          <span className="font-medium">Show models</span>
                          <Badge variant="outline">{models.length} total</Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {models.map((model) => (
                            <div key={model.identifier} className="rounded-xl border border-border/60 bg-background/80 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">{model.name}</p>
                                <Badge variant="outline">{model.identifier}</Badge>
                                <Badge variant="outline">{model.provider || "unknown"}</Badge>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Badge variant="outline">{model.type}</Badge>
                                {model.defaultAspectRatio ? (
                                  <Badge variant="outline">{model.defaultAspectRatio}</Badge>
                                ) : null}
                                {typeof model.modelCost === "number" ? (
                                  <Badge variant="outline">{model.modelCost} credits</Badge>
                                ) : null}
                                {model.supportsReferenceImage ? (
                                  <Badge variant="outline">ref image</Badge>
                                ) : null}
                                {model.supportsReferenceVideo ? (
                                  <Badge variant="outline">ref video</Badge>
                                ) : null}
                                {model.supportsReferenceAudio ? (
                                  <Badge variant="outline">ref audio</Badge>
                                ) : null}
                                {model.supportsFirstFrame ? (
                                  <Badge variant="outline">first frame</Badge>
                                ) : null}
                                {model.supportsLastFrame ? (
                                  <Badge variant="outline">last frame</Badge>
                                ) : null}
                              </div>
                              {model.description ? (
                                <p className="mt-2 text-xs text-muted-foreground">{model.description}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : null}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-searchAssets") {
          const toolPart = part as SearchAssetsToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Searching assets</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.input?.query
                        ? `Looking for ${toolPart.input.query}`
                        : `Loading ${toolPart.input?.assetType || "saved"} assets`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Asset search failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const assets = toolPart.output?.assets ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Assets</Badge>
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">{toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}</Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                <div className="space-y-2">
                  {assets.map((asset) => (
                    <div key={asset.id} className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{asset.title}</p>
                        <Badge variant="outline">{asset.assetType}</Badge>
                        <Badge variant="outline">{asset.category}</Badge>
                        <Badge variant="outline">{asset.visibility}</Badge>
                      </div>
                      {asset.description ? (
                        <p className="mt-2 text-xs text-muted-foreground">{asset.description}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-listRecentGenerations") {
          const toolPart = part as ListRecentGenerationsToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Checking recent generations</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.input?.query
                        ? `Looking for ${toolPart.input.query}`
                        : `Loading recent ${toolPart.input?.type || "creative"} outputs`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Recent generations lookup failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const generations = toolPart.output?.generations ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Recent Generations</Badge>
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">
                      {toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                <div className="space-y-2">
                  {generations.map((generation) => (
                    <div key={generation.id} className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{generation.id}</p>
                        <Badge variant="outline">{generation.type}</Badge>
                        <Badge variant="outline">{generation.status}</Badge>
                        {generation.aspectRatio ? (
                          <Badge variant="outline">{generation.aspectRatio}</Badge>
                        ) : null}
                        {generation.linkedAsset ? (
                          <Badge>{`Saved as ${generation.linkedAsset.title}`}</Badge>
                        ) : null}
                      </div>
                      {generation.prompt ? (
                        <p className="mt-2 text-xs text-muted-foreground">{generation.prompt}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {generation.model ? <span>{generation.model}</span> : null}
                        <span>{new Date(generation.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-listThreadMedia") {
          const toolPart = part as ListThreadMediaToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Loading thread media</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.input?.mediaKind && toolPart.input.mediaKind !== "all"
                        ? `Filter: ${toolPart.input.mediaKind}`
                        : "Listing uploads and generations for this chat"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Thread media list failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const items = toolPart.output?.items ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="gap-1">
                    <Images className="h-3.5 w-3.5" aria-hidden />
                    Thread media
                  </Badge>
                  {typeof toolPart.output?.count === "number" ? (
                    <Badge variant="outline">
                      {toolPart.output.count} item{toolPart.output.count === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  IDs here are valid <span className="font-mono">mediaIds</span> for image/video tools. Use
                  listThreadMedia before referencing earlier chat visuals.
                </p>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No media registered for this thread yet.</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => {
                      const isImage = item.mimeType.startsWith("image/")
                      return (
                        <div
                          key={item.id}
                          className="flex gap-3 rounded-xl border border-border/60 bg-background/80 p-3"
                        >
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                            {isImage ? (
                              <img
                                src={item.publicUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-muted-foreground">
                                {item.mimeType}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium leading-snug">{item.label}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{item.mediaKind}</Badge>
                              <Badge variant="outline">{item.mimeType}</Badge>
                            </div>
                            <p className="font-mono text-[11px] text-muted-foreground break-all">
                              {item.id}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(item.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-saveGenerationAsAsset") {
          const toolPart = part as SaveGenerationAsAssetToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Saving generation as asset</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.input?.title
                        ? `Creating ${toolPart.input.title}`
                        : `Saving generation ${toolPart.input?.generationId || ""}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Saving asset failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const asset = toolPart.output?.asset
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{toolPart.output?.alreadySaved ? "Existing Asset" : "Asset Saved"}</Badge>
                  {asset ? <Badge variant="outline">{asset.assetType}</Badge> : null}
                  {asset ? <Badge variant="outline">{asset.category}</Badge> : null}
                  {asset ? <Badge variant="outline">{asset.visibility}</Badge> : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {asset ? (
                  <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                    <p className="text-sm font-medium">{asset.title}</p>
                    {asset.description ? (
                      <p className="mt-2 text-xs text-muted-foreground">{asset.description}</p>
                    ) : null}
                    {asset.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {asset.tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-getBrandContext") {
          const toolPart = part as GetBrandContextToolPart

          if (toolPart.state === "input-streaming") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Looking up brand context...
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Checking brand context</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.input?.brandName
                        ? `Matching ${toolPart.input.brandName}`
                        : "Resolving saved brand"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card
                key={`${message.id}-${index}`}
                className="border-destructive/30 bg-destructive/5"
              >
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Brand context lookup failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-available") {
            const output = toolPart.output
            const brand = output?.brand
            const availableBrands = output?.availableBrands ?? []

            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
                <CardContent className="space-y-3 p-4">
                  {brand ? (
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background">
                        {brand.iconUrl ? (
                          <img
                            src={brand.iconUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium text-muted-foreground">
                            {brand.name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{brand.name}</p>
                        {brand.websiteUrl ? (
                          <p className="truncate text-xs text-muted-foreground">{brand.websiteUrl}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {output?.message ? (
                    <p className="text-sm text-muted-foreground">{output.message}</p>
                  ) : null}

                  {!brand && availableBrands.length > 0 ? (
                    <div className="space-y-2">
                      {availableBrands.slice(0, 3).map((candidate) => (
                        <div key={candidate.id} className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background">
                            {candidate.iconUrl ? (
                              <img
                                src={candidate.iconUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-medium text-muted-foreground">
                                {candidate.name.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {candidate.name}
                              {candidate.isDefault ? " (default)" : ""}
                            </p>
                            {candidate.websiteUrl ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {candidate.websiteUrl}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          }
        }

        if (part.type === "tool-saveSkill") {
          const toolPart = part as SaveSkillToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Saving skill{toolPart.input?.slug ? ` “${toolPart.input.slug}”` : ""}…
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card
                key={`${message.id}-${index}`}
                className="border-destructive/30 bg-destructive/5"
              >
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Skill save failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-available") {
            const output = toolPart.output
            const ok = output?.status === "saved"
            return (
              <Card
                key={`${message.id}-${index}`}
                className={
                  ok ? "border-border/60 bg-muted/10" : "border-destructive/30 bg-destructive/5"
                }
              >
                <CardContent className="space-y-1 p-4 text-sm">
                  <p className="font-medium">{ok ? "Skill saved" : "Skill not saved"}</p>
                  {output?.slug ? (
                    <p className="text-muted-foreground">
                      <span className="font-mono text-xs">{output.slug}</span>
                    </p>
                  ) : null}
                  {output?.message ? <p className="text-muted-foreground">{output.message}</p> : null}
                </CardContent>
              </Card>
            )
          }
        }

        if (part.type === "tool-activateSkill") {
          const toolPart = part as ActivateSkillToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Loading skill{toolPart.input?.slug ? ` “${toolPart.input.slug}”` : ""}…
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card
                key={`${message.id}-${index}`}
                className="border-destructive/30 bg-destructive/5"
              >
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Skill activation failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-available") {
            const output = toolPart.output
            const ok = output?.status === "ok"
            return (
              <Card
                key={`${message.id}-${index}`}
                className={
                  ok ? "border-border/60 bg-muted/10" : "border-destructive/30 bg-destructive/5"
                }
              >
                <CardContent className="space-y-1 p-4 text-sm">
                  <p className="font-medium">{ok ? "Skill loaded" : "Skill not loaded"}</p>
                  {output?.slug ? (
                    <p className="text-muted-foreground">
                      {output.title ? `${output.title} · ` : null}
                      <span className="font-mono text-xs">{output.slug}</span>
                    </p>
                  ) : null}
                  {output?.message ? <p className="text-muted-foreground">{output.message}</p> : null}
                </CardContent>
              </Card>
            )
          }
        }

        if (part.type === "tool-scheduleGenerationFollowUp") {
          const toolPart = part as ScheduleGenerationFollowUpToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Scheduling automatic follow-up when generation finishes…
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card
                key={`${message.id}-${index}`}
                className="border-destructive/30 bg-destructive/5"
              >
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Could not schedule follow-up</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-available") {
            const output = toolPart.output
            const ok = output?.status === "scheduled"
            return (
              <Card
                key={`${message.id}-${index}`}
                className={
                  ok ? "border-border/60 bg-muted/10" : "border-destructive/30 bg-destructive/5"
                }
              >
                <CardContent className="space-y-1 p-4 text-sm">
                  <p className="font-medium">
                    {ok ? "Follow-up scheduled" : "Follow-up not scheduled"}
                  </p>
                  {output?.generationId ? (
                    <p className="font-mono text-xs text-muted-foreground">{output.generationId}</p>
                  ) : null}
                  {output?.message ? <p className="text-muted-foreground">{output.message}</p> : null}
                  {output?.error ? <p className="text-destructive">{output.error}</p> : null}
                </CardContent>
              </Card>
            )
          }
        }

        if (part.type === "tool-awaitGeneration") {
          const toolPart = part as AwaitGenerationToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            const waitSeconds = toolPart.input?.maxWaitSeconds
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Waiting for generation to finish
                  {typeof waitSeconds === "number" ? ` (up to ${waitSeconds}s)` : ""}…
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card
                key={`${message.id}-${index}`}
                className="border-destructive/30 bg-destructive/5"
              >
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Wait failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-available") {
            const output = toolPart.output
            const status = output?.status
            if (status === "completed") {
              return (
                <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
                  <CardContent className="space-y-1 p-4 text-sm">
                    <p className="font-medium">
                      {output?.kind === "video" ? "Video" : "Image"} ready
                    </p>
                    <p className="text-muted-foreground">Generation finished successfully.</p>
                  </CardContent>
                </Card>
              )
            }
            if (status === "timeout") {
              return (
                <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                  <CardContent className="space-y-1 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Still generating…</p>
                    <p>
                      {output?.message ||
                        "The chat UI will update when it completes. Feel free to keep going."}
                    </p>
                  </CardContent>
                </Card>
              )
            }
            return (
              <Card
                key={`${message.id}-${index}`}
                className="border-destructive/30 bg-destructive/5"
              >
                <CardContent className="space-y-1 p-4 text-sm text-destructive">
                  <p className="font-medium">Generation failed</p>
                  <p>{output?.error || "Generation did not complete."}</p>
                </CardContent>
              </Card>
            )
          }
        }

        return null
      })}
    </>
  )
}

export function CreativeAgentChat({
  compact = false,
  enablePersistence = false,
  initialMessages = EMPTY_MESSAGES,
  initialThreadId,
  mobileThreads,
  onThreadIdChange,
  syncUrlOnThreadCreate = false,
}: {
  compact?: boolean
  enablePersistence?: boolean
  initialMessages?: UIMessage[]
  initialThreadId?: string
  /** When set (e.g. logged-in chat page), shows mobile history dropdown + new chat bar. */
  mobileThreads?: MobileChatThreadListItem[]
  onThreadIdChange?: (threadId: string | undefined) => void
  syncUrlOnThreadCreate?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [assetModalOpen, setAssetModalOpen] = React.useState(false)
  const [composerDropActive, setComposerDropActive] = React.useState(false)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [authReady, setAuthReady] = React.useState(false)
  const [composerValue, setComposerValue] = React.useState("")
  const [attachedFiles, setAttachedFiles] = React.useState<ComposerUploadAttachment[]>([])
  const [attachedRefs, setAttachedRefs] = React.useState<AttachedRef[]>([])
  const [instagramConnections, setInstagramConnections] = React.useState<InstagramConnectionToolSummary[]>([])
  const [threadId, setThreadId] = React.useState<string | undefined>(initialThreadId)
  const [isCreatingThread, setIsCreatingThread] = React.useState(false)
  const initialChatId = React.useMemo(() => initialThreadId ?? "creative-chat-draft", [initialThreadId])
  const threadIdRef = React.useRef<string | undefined>(initialThreadId)
  const chatGatewayModelRef = React.useRef<string>(DEFAULT_CHAT_GATEWAY_MODEL)
  const [chatGatewayModelId, setChatGatewayModelId] = React.useState<string>(DEFAULT_CHAT_GATEWAY_MODEL)

  const selectedChatGatewayOption = React.useMemo(
    () =>
      CHAT_GATEWAY_MODEL_OPTIONS.find((option) => option.id === chatGatewayModelId) ??
      CHAT_GATEWAY_MODEL_OPTIONS[0],
    [chatGatewayModelId],
  )

  const chat = React.useMemo(
    () =>
      new Chat({
        id: initialChatId,
        messages: initialMessages,
        onFinish: () => {
          const activeThreadId = threadIdRef.current

          if (
            enablePersistence &&
            syncUrlOnThreadCreate &&
            activeThreadId &&
            window.location.pathname !== `/chat/${activeThreadId}`
          ) {
            window.history.replaceState(window.history.state, "", `/chat/${activeThreadId}`)
          }
        },
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
        transport: new DefaultChatTransport({
          api: "/api/chat",
          prepareSendMessagesRequest: ({ messages }) => {
            const model = chatGatewayModelRef.current
            if (enablePersistence && threadIdRef.current && messages.length > 0) {
              return {
                body: {
                  message: messages[messages.length - 1],
                  mode: "chat",
                  model,
                  threadId: threadIdRef.current,
                },
              }
            }

            return {
              body: {
                messages,
                mode: "chat",
                model,
                threadId: threadIdRef.current,
              },
            }
          },
        }),
      }),
    [enablePersistence, initialChatId, initialMessages, syncUrlOnThreadCreate],
  )

  const { addToolApprovalResponse, messages, sendMessage, setMessages, status, error } = useChat({
    chat,
    experimental_throttle: 50,
  })

  React.useEffect(() => {
    const supabase = createSupabaseClient()

    let cancelled = false
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return
        setUserId(data.user?.id ?? null)
        setAuthReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setUserId(null)
        setAuthReady(true)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
      setAuthReady(true)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  React.useEffect(() => {
    if (!authReady || !userId) {
      setInstagramConnections([])
      return
    }

    let cancelled = false

    void fetch("/api/instagram/status", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load Instagram accounts.")
        }
        return response.json() as Promise<{
          connections?: Array<{
            accountType?: string | null
            id: string
            instagramUserId?: string | null
            instagramUsername?: string | null
            profileFetchedAt?: string | null
            tokenExpiresAt?: string | null
            updatedAt: string
          }>
        }>
      })
      .then((data) => {
        if (cancelled) return
        setInstagramConnections(
          Array.isArray(data.connections)
            ? data.connections.map((connection) => ({
                accountType: connection.accountType ?? null,
                id: connection.id,
                instagramUserId: connection.instagramUserId ?? null,
                instagramUsername: connection.instagramUsername ?? null,
                profileFetchedAt: connection.profileFetchedAt ?? null,
                tokenExpiresAt: connection.tokenExpiresAt ?? null,
                updatedAt: connection.updatedAt,
              }))
            : [],
        )
      })
      .catch(() => {
        if (cancelled) return
        setInstagramConnections([])
      })

    return () => {
      cancelled = true
    }
  }, [authReady, userId])

  const instagramConnectionsById = React.useMemo(
    () => new Map(instagramConnections.map((connection) => [connection.id, connection])),
    [instagramConnections],
  )

  const assetAttachments = React.useMemo<ComposerAssetAttachment[]>(
    () =>
      attachedRefs.flatMap((ref) => {
        if (ref.category !== "asset" || !ref.assetUrl || !ref.assetType) {
          return []
        }

        return [
          {
            assetType: ref.assetType,
            id: ref.chipId,
            ref,
            source: "asset" as const,
            title: ref.label,
            url: ref.assetUrl,
          },
        ]
      }),
    [attachedRefs],
  )

  const composerAttachments = React.useMemo<ComposerAttachment[]>(
    () => [...attachedFiles, ...assetAttachments],
    [assetAttachments, attachedFiles],
  )

  const hasPendingUploads = attachedFiles.some((attachment) => attachment.isUploading)
  const newChatToken = searchParams.get("new")

  React.useEffect(() => {
    setThreadId(initialThreadId)
    threadIdRef.current = initialThreadId
  }, [initialThreadId])

  React.useEffect(() => {
    if (!enablePersistence) {
      return
    }

    setMessages(initialMessages)
  }, [enablePersistence, initialMessages, setMessages])

  React.useEffect(() => {
    if (!newChatToken) {
      return
    }

    setMessages([])
    setComposerValue("")
    setAttachedFiles([])
    setAttachedRefs([])
    setThreadId(undefined)
    threadIdRef.current = undefined
    onThreadIdChange?.(undefined)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    router.replace("/chat")
  }, [newChatToken, onThreadIdChange, router, setMessages])

  const handleAttachFiles = React.useCallback(async (files: File[]) => {
    if (files.length === 0) return

    const nextAttachments: ComposerUploadAttachment[] = files.map((file) => ({
      file,
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      isUploading: inferMediaTypeFromFile(file) !== "other",
      source: "upload",
    }))

    setAttachedFiles((prev) => [...prev, ...nextAttachments])

    await Promise.all(
      nextAttachments.map(async (attachment) => {
        if (!attachment.isUploading) {
          return
        }

        const result = await uploadFileToSupabase(attachment.file, "chat-user-uploads")

        setAttachedFiles((prev) =>
          prev.map((item) =>
            item.id === attachment.id
              ? {
                  ...item,
                  isUploading: false,
                  uploadedUrl: result?.url,
                }
              : item,
          ),
        )
      }),
    )
  }, [])

  const handleAssetLibrarySelect = React.useCallback((imageUrl: string) => {
    setAttachedRefs((prev) => [...prev, attachedRefFromDroppedMediaUrl(imageUrl, "image")])
    setAssetModalOpen(false)
  }, [])

  const handleComposerDragEnter = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!composerDropTypesAccept(event.dataTransfer)) return
    event.preventDefault()
    setComposerDropActive(true)
  }, [])

  const handleComposerDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!composerDropTypesAccept(event.dataTransfer)) return
    const next = event.relatedTarget as Node | null
    if (next && event.currentTarget.contains(next)) return
    setComposerDropActive(false)
  }, [])

  const processComposerDrop = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setComposerDropActive(false)

      const rawNode = event.dataTransfer.getData(REACTFLOW_NODE_MIME)
      if (rawNode) {
        try {
          const parsed = JSON.parse(rawNode) as unknown
          const extracted = extractAssetFromNode(parsed)
          if (extracted) {
            setAttachedRefs((prev) => [...prev, attachedRefFromDroppedMediaUrl(extracted.url, extracted.type)])
            return
          }
        } catch {
          /* ignore malformed payload */
        }
      }

      const files = Array.from(event.dataTransfer.files ?? [])
      if (files.length > 0) {
        void handleAttachFiles(files)
      }
    },
    [handleAttachFiles],
  )

  const handleComposerDropCapture = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!composerDropTypesAccept(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()
      processComposerDrop(event)
    },
    [processComposerDrop],
  )

  const handleComposerDragOverCapture = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!composerDropTypesAccept(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }, [])

  const removeAttachedRef = React.useCallback((ref: AttachedRef) => {
    setAttachedRefs((prev) => prev.filter((item) => item.chipId !== ref.chipId))
    setComposerValue((prev) => {
      if (!ref.mentionToken) {
        return prev
      }

      const start = prev.indexOf(ref.mentionToken)
      if (start === -1) {
        return prev
      }

      const end = extendMentionRangeEnd(prev, start, ref.mentionToken.length)
      return prev.slice(0, start) + prev.slice(end)
    })
  }, [])

  const transcribeAudioBlob = React.useCallback(async (audioBlob: Blob) => {
    const formData = new FormData()
    formData.append("audio", audioBlob, "audio.webm")

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    })

    const payload = (await response.json().catch(() => ({}))) as { error?: string; text?: string }

    if (!response.ok) {
      throw new Error(payload.error || "Transcription failed")
    }

    return typeof payload.text === "string" ? payload.text : ""
  }, [])

  const handleSpeechTranscription = React.useCallback((text: string) => {
    const next = text.trim()
    if (!next) return

    setComposerValue((prev) => {
      const p = prev.trimEnd()
      if (!p) return next
      return `${p} ${next}`
    })
  }, [])

  const handleSpeechError = React.useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : "Voice input failed"
    toast.error(message)
  }, [])

  const handleSendMessage = React.useCallback(async () => {
    if (!userId) return
    if (!composerValue.trim() && composerAttachments.length === 0) return
    if (hasPendingUploads) return
    if (isCreatingThread) return

    const parts: UIMessage["parts"] = []
    if (composerValue.trim()) {
      parts.push({ type: "text", text: composerValue.trim() })
    }
    parts.push(...(await filesToMessageParts(composerAttachments)))

    let nextThreadId = threadId

    if (enablePersistence && !nextThreadId) {
      setIsCreatingThread(true)

      try {
        const response = await fetch("/api/chat/threads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title:
              composerValue.trim() ||
              (composerAttachments[0]?.source === "upload"
                ? composerAttachments[0].file.name
                : composerAttachments[0]?.title) ||
              attachedRefs[0]?.label ||
              "New Chat",
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to create chat thread.")
        }

        const data = await response.json()
        nextThreadId = data.thread?.id

        if (!nextThreadId) {
          throw new Error("Chat thread ID was missing from the response.")
        }

        threadIdRef.current = nextThreadId
        setThreadId(nextThreadId)
        onThreadIdChange?.(nextThreadId)

        if (syncUrlOnThreadCreate && window.location.pathname !== `/chat/${nextThreadId}`) {
          window.history.replaceState(window.history.state, "", `/chat/${nextThreadId}`)
        }
      } finally {
        setIsCreatingThread(false)
      }
    }

    if (nextThreadId) {
      threadIdRef.current = nextThreadId
    }

    sendMessage({
      metadata: refsToChatMetadata(attachedRefs),
      role: "user",
      parts,
    })

    setComposerValue("")
    setAttachedFiles([])
    setAttachedRefs([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [attachedRefs, composerAttachments, composerValue, enablePersistence, hasPendingUploads, isCreatingThread, onThreadIdChange, sendMessage, syncUrlOnThreadCreate, threadId, userId])

  const clearChat = React.useCallback(() => {
    const shouldNavigateToDraft = enablePersistence && Boolean(threadId)

    setMessages([])
    setComposerValue("")
    setAttachedFiles([])
    setAttachedRefs([])
    setThreadId(undefined)
    threadIdRef.current = undefined
    onThreadIdChange?.(undefined)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    if (shouldNavigateToDraft) {
      router.push("/chat")
    }
  }, [enablePersistence, onThreadIdChange, router, setMessages, threadId])

  const showLoggedInEmptyState = authReady && userId && messages.length === 0
  const showSubmittedLoading = status === "submitted" && messages.length > 0

  return (
    <div
      className={cn(
        "flex flex-col",
        compact
          ? "h-full min-h-0 bg-transparent pt-0"
          : "h-dvh min-h-0 overflow-hidden bg-background pt-16 md:pt-20 px-0 lg:px-4",
      )}
    >
      {compact && mobileThreads !== undefined ? (
        <div className="flex shrink-0 items-center justify-start gap-2 bg-background/95 px-3 py-2 backdrop-blur md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="shrink-0 shadow-depth-l"
                aria-label="Chat history"
              >
                <ClockCounterClockwise className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[min(100vw-2rem,20rem)] max-h-[min(70vh,24rem)] overflow-y-auto">
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                Chat history
              </DropdownMenuLabel>
              {mobileThreads.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  No threads yet. Start a conversation to build your history.
                </div>
              ) : (
                mobileThreads.map((thread) => {
                  const isActive = threadId === thread.id
                  return (
                    <DropdownMenuItem key={thread.id} asChild>
                      <Link
                        href={`/chat/${thread.id}`}
                        className={cn(
                          "flex cursor-pointer flex-col items-start gap-0.5 py-2",
                          isActive && "bg-accent/50",
                        )}
                      >
                        <span className="flex w-full flex-wrap items-center gap-1.5 text-left">
                          <span className="line-clamp-2 flex-1 text-sm font-medium">{thread.title}</span>
                          {thread.source === "automation" ? (
                            <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                              Automation
                            </span>
                          ) : null}
                          {thread.source === "automation" && thread.automation_trigger === "manual" ? (
                            <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium">
                              Manual
                            </span>
                          ) : null}
                          {thread.source === "automation" && thread.automation_trigger === "scheduled" ? (
                            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                              Scheduled
                            </span>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatThreadUpdatedAt(thread.updated_at)}
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  )
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="shrink-0 shadow-depth-l"
            aria-label="New chat"
            onClick={clearChat}
          >
            <NotePencil className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          "mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col",
          compact ? "h-full" : "",
        )}
      >
        {!compact ? (
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/30">
                  <Image
                    src="/logo.svg"
                    alt="Website AI"
                    width={12}
                    height={12}
                    className="dark:invert"
                  />
                </span>
                <p className="truncate text-sm font-semibold">Chat</p>
              </div>
              <p className="text-xs text-muted-foreground">
                General creative chat
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={clearChat}>
              <NotePencil className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </div>
        ) : null}

        <Conversation className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <ConversationContent
            className={
              messages.length === 0
                ? "flex min-h-full flex-col items-center justify-center gap-6 px-4 py-6 text-center"
                : "mx-auto w-full max-w-4xl px-4 py-6"
            }
          >
            {!authReady ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleNotch className="h-4 w-4 animate-spin" />
                Loading chat...
              </div>
            ) : null}

            {authReady && !userId ? (
              <Card className="w-full max-w-lg border-border/60 bg-muted/20">
                <CardContent className="space-y-4 p-6 text-center">
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">Log in to use chat</p>
                    <p className="text-sm text-muted-foreground">
                      Chat currently uses your authenticated session for model access.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Button asChild>
                      <a href="/login">Login</a>
                    </Button>
                    <Button asChild variant="outline">
                      <a href="/login?mode=signup">Signup</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {showLoggedInEmptyState ? (
              <div className="flex w-full max-w-2xl flex-col items-center gap-2">
                <ConversationEmptyState
                  className="pb-0"
                  icon={(
                    <span className="flex size-12 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/30">
                      <Image
                        src="/logo.svg"
                        alt="Website AI"
                        width={22}
                        height={22}
                        className="dark:invert"
                      />
                    </span>
                  )}
                  title="Start a conversation"
                  description="Ask a question, attach references, brainstorm ideas, or talk through a creative direction."
                />
                <Suggestions className="justify-center">
                  {STARTER_PROMPTS.map((item) => (
                    <Suggestion
                      key={item.prompt}
                      suggestion={item.prompt}
                      title={item.prompt}
                      onClick={(value) => setComposerValue(value)}
                    >
                      {item.label}
                    </Suggestion>
                  ))}
                </Suggestions>
              </div>
            ) : null}

            {messages.map((message) => {
              const isUserMessage = message.role === "user"

              return (
                <Message
                  key={message.id}
                  from={isUserMessage ? "user" : "assistant"}
                  className={cn(!isUserMessage && "mb-2")}
                >
                  {isUserMessage ? (
                    <MessageContent className="max-w-[85%] rounded-[24px] px-4 py-3 shadow-sm">
                      <MessageParts
                        message={message}
                        instagramConnectionsById={instagramConnectionsById}
                        onToolApprovalResponse={(approvalId, approved) => {
                          void addToolApprovalResponse({
                            id: approvalId,
                            approved,
                          })
                        }}
                      />
                    </MessageContent>
                  ) : (
                    <div className="flex w-full min-w-0 max-w-3xl items-start gap-3">
                      <span className="mt-1 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/40">
                        <Image
                          src="/logo.svg"
                          alt="Website AI"
                          width={16}
                          height={16}
                          className="dark:invert"
                        />
                      </span>
                      <div className="min-w-0 flex-1 space-y-3 text-left text-[15px] leading-7 text-foreground">
                        <MessageParts
                          message={message}
                          instagramConnectionsById={instagramConnectionsById}
                          onToolApprovalResponse={(approvalId, approved) => {
                            void addToolApprovalResponse({
                              id: approvalId,
                              approved,
                            })
                          }}
                        />
                      </div>
                    </div>
                  )}
                </Message>
              )
            })}

            {showSubmittedLoading ? (
              <Message from="assistant" className="mb-2">
                <div className="flex w-full min-w-0 max-w-3xl items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/40">
                    <Image
                      src="/logo.svg"
                      alt="Website AI"
                      width={16}
                      height={16}
                      className="dark:invert"
                    />
                  </span>
                  <div className="min-w-0 flex-1 text-left text-sm text-foreground">
                    <Shimmer className="leading-none">Loading...</Shimmer>
                  </div>
                </div>
              </Message>
            ) : null}

            {error ? (
              <Card className="w-full border-destructive/30 bg-destructive/5">
                <CardContent className="p-4 text-sm text-destructive">
                  {error.message || "Chat failed. Please try again."}
                </CardContent>
              </Card>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="z-10 shrink-0 bg-transparent px-4 pb-5 pt-3">
          <div className="mx-auto max-w-4xl space-y-3">
            {userId && (composerAttachments.length > 0 || attachedRefs.some((ref) => ref.category === "brand")) ? (
              <div className="flex flex-wrap items-start gap-2">
                {composerAttachments.length > 0 ? (
                  <ComposerAttachmentPreviews
                    attachments={composerAttachments}
                    onRemove={(attachment) => {
                      if (attachment.source === "upload") {
                        setAttachedFiles((prev) => prev.filter((item) => item.id !== attachment.id))
                        return
                      }

                      removeAttachedRef(attachment.ref)
                    }}
                  />
                ) : null}

                <ChatBrandPills
                  refs={brandReferencesOnly(
                    attachedRefs.map((ref) => ({
                      assetType: ref.assetType,
                      assetUrl: ref.assetUrl,
                      category: ref.category,
                      id: ref.id,
                      label: ref.label,
                      previewUrl: ref.previewUrl,
                    })),
                  )}
                  onRemove={(id) => {
                    const ref = attachedRefs.find((item) => item.id === id)
                    if (ref) {
                      removeAttachedRef(ref)
                    }
                  }}
                />
              </div>
            ) : null}

            {userId ? (
              <>
              <div
                className={cn(
                  "rounded-[26px] p-2 transition-[box-shadow,ring-color]",
                  composerDropActive && "ring-2 ring-primary/50 ring-offset-2 ring-offset-transparent",
                )}
                onDragEnter={handleComposerDragEnter}
                onDragLeave={handleComposerDragLeave}
                onDragOverCapture={handleComposerDragOverCapture}
                onDropCapture={handleComposerDropCapture}
              >
                <InputGroup className="items-end rounded-[22px] border-border/60 bg-background/95 p-1 shadow-2xl backdrop-blur-sm has-[textarea]:rounded-[22px]">
                  <CommandTextarea
                    value={composerValue}
                    onChange={setComposerValue}
                    refs={attachedRefs}
                    onRefsChange={setAttachedRefs}
                    rows={3}
                    className="min-h-[72px] max-h-[180px] flex-1 px-3 py-2"
                    placeholder="You can start anywhere: say what you want to create, paste ideas, attach references, or just ask a question. Type / to open agent shortcuts, and @ to mention a brand or pull in assets."
                    slashCommands={CHAT_AGENT_COMMANDS}
                    slashCommandsContext="Agent"
                    onPasteImage={(file) => void handleAttachFiles([file])}
                    onPromptKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        void handleSendMessage()
                      }
                    }}
                  />
                  <InputGroupAddon align="block-end" className="gap-2 justify-between">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? [])
                        void handleAttachFiles(files)
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ""
                        }
                      }}
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Attach files or assets"
                            disabled={
                              isCreatingThread ||
                              status === "submitted" ||
                              status === "streaming"
                            }
                          >
                            <Plus className="h-4 w-4" />
                            <span className="sr-only">Attach</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="top" sideOffset={4}>
                          <DropdownMenuItem
                            onClick={() => fileInputRef.current?.click()}
                            disabled={
                              isCreatingThread ||
                              status === "submitted" ||
                              status === "streaming"
                            }
                          >
                            <FilePlus className="mr-2 size-4" />
                            Upload files
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setAssetModalOpen(true)}
                            disabled={
                              isCreatingThread ||
                              status === "submitted" ||
                              status === "streaming"
                            }
                          >
                            <FolderOpen className="mr-2 size-4" />
                            Select asset
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Select
                        value={chatGatewayModelId}
                        onValueChange={(value) => {
                          chatGatewayModelRef.current = value
                          setChatGatewayModelId(value)
                        }}
                        disabled={
                          isCreatingThread ||
                          status === "submitted" ||
                          status === "streaming"
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          aria-label="Chat model"
                          className="h-9 w-fit min-w-0 max-w-[min(100%,16rem)] shrink border-border/50 bg-background/40 px-2.5 hover:bg-background/60"
                        >
                          <SelectValue placeholder="Model">
                            <div className="flex min-w-0 items-center gap-2">
                              <ModelIcon identifier={selectedChatGatewayOption.id} size={16} />
                              <span className="truncate">{selectedChatGatewayOption.label}</span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent align="start" position="popper" sideOffset={4} className="w-[min(calc(100vw-2rem),22rem)]">
                          {CHAT_GATEWAY_MODEL_OPTIONS.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              <div className="flex items-center gap-3">
                                <div className="shrink-0 rounded-md border border-border bg-muted/30 p-1.5">
                                  <ModelIcon identifier={option.id} size={20} />
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <span className="text-sm font-semibold">{option.label}</span>
                                  {option.description ? (
                                    <span className="text-xs text-muted-foreground">{option.description}</span>
                                  ) : null}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <SpeechInput
                        forceServerTranscription
                        variant="ghost"
                        size="icon"
                        aria-label="Voice input"
                        onAudioRecorded={transcribeAudioBlob}
                        onTranscriptionChange={handleSpeechTranscription}
                        onTranscriptionError={handleSpeechError}
                        disabled={
                          isCreatingThread ||
                          status === "submitted" ||
                          status === "streaming"
                        }
                      />
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => void handleSendMessage()}
                        disabled={
                          isCreatingThread ||
                          hasPendingUploads ||
                          status === "submitted" ||
                          status === "streaming" ||
                          (!composerValue.trim() && composerAttachments.length === 0)
                        }
                      >
                        {isCreatingThread || hasPendingUploads || status === "submitted" || status === "streaming" ? (
                          <CircleNotch className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowUp className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </InputGroupAddon>
                </InputGroup>
              </div>
              <AssetSelectionModal
                open={assetModalOpen}
                onOpenChange={setAssetModalOpen}
                onSelect={handleAssetLibrarySelect}
              />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
