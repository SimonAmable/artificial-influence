/** AI SDK tool UI part shapes for the creative agent chat. */

import type { AttachedRef } from "@/lib/commands/types"

export type GenerateImageToolPart = {
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
    referenceImageUrls?: string[]
    variantCount?: number
  }
  errorText?: string
}

export type UpscaleImageToolPart = {
  type: "tool-upscaleImage"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    assetIds?: string[]
    enhanceDetails?: boolean
    enhanceRealism?: boolean
    mediaIds?: string[]
    modelIdentifier?: string
    outputFormat?: "jpg" | "png" | "webp"
    referenceIds?: string[]
    scaleFactor?: number
    targetMegapixels?: number
    upscaleMode?: "target" | "factor"
  }
  output?: {
    creditsUsed?: number
    generationId?: string | null
    images?: Array<{
      mimeType?: string
      storagePath?: string | null
      url: string
    }>
    message?: string
    model?: string
    status?: "completed" | "failed"
    usedReferenceCount?: number
    referenceImageUrls?: string[]
  }
  errorText?: string
}

export type UniversalGenerateImageToolPart = {
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
    referenceImageUrls?: string[]
    variantCount?: number
  }
  errorText?: string
}

export type GenerateVideoToolPart = {
  type: "tool-generateVideo"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    aspectRatio?: string
    assetIds?: string[]
    characterOrientation?: "image" | "video"
    draft?: boolean
    duration?: number
    generateAudio?: boolean
    keepOriginalSound?: boolean
    mediaIds?: string[]
    mode?: "pro" | "std"
    modelIdentifier?: string
    negativePrompt?: string
    prompt?: string
    referenceAudioIds?: string[]
    referenceIds?: string[]
    referenceVideoIds?: string[]
    resolution?: string
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

export type GenerateAudioToolPart = {
  type: "tool-generateAudio"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    languageCode?: string
    modelIdentifier?: string
    provider?: "inworld" | "google"
    stylePrompt?: string
    text?: string
    voiceId?: string
  }
  output?: {
    audio?: {
      mimeType?: string
      storagePath?: string | null
      url: string
    }
    generationId?: string | null
    message?: string
    model?: string
    provider?: "inworld" | "google"
    status?: "completed" | "failed"
    voiceDisplayName?: string | null
    voiceId?: string
  }
  errorText?: string
}

export type ModelsToolPart = {
  type: "tool-listModels" | "tool-searchModels"
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
    defaultImageModel?: string | null
  }
  errorText?: string
}

export type SearchVoicesToolPart = {
  type: "tool-searchVoices"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    languageCodes?: string[]
    limit?: number
    provider?: "inworld" | "google"
    query?: string
    source?: "SYSTEM" | "IVC" | "PVC"
  }
  output?: {
    message?: string
    provider?: "inworld" | "google" | null
    query?: string | null
    source?: "SYSTEM" | "IVC" | "PVC" | null
    total?: number
    voices?: Array<{
      description: string
      displayName: string
      langCode: string
      model?: string | null
      previewAudioUrl?: string | null
      previewText?: string | null
      provider?: string | null
      source: string
      tags: string[]
      voiceId: string
    }>
  }
  errorText?: string
}

export type SearchWebToolPart = {
  type: "tool-searchWeb"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    limit?: number
    query?: string
  }
  output?: {
    message?: string
    provider?: "firecrawl"
    query?: string
    results?: Array<{
      source?: string | null
      snippet?: string | null
      title: string
      url: string
    }>
    total?: number
  }
  errorText?: string
}

export type ReadWebPageToolPart = {
  type: "tool-readWebPage"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    maxChars?: number
    url?: string
  }
  output?: {
    fallbackReason?: string | null
    message?: string
    provider?: "simple" | "firecrawl"
    page?: {
      description?: string | null
      finalUrl: string
      images: Array<{ alt?: string | null; url: string }>
      links: Array<{ text?: string | null; url: string }>
      markdown: string
      provider: "simple" | "firecrawl"
      text: string
      title?: string | null
      url: string
    }
  }
  errorText?: string
}

export type SearchWebImagesToolPart = {
  type: "tool-searchWebImages"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    limit?: number
    query?: string
  }
  output?: {
    images?: Array<{
      height?: number | null
      imageUrl: string
      sourceDomain?: string | null
      sourcePageUrl: string
      title: string
      width?: number | null
    }>
    licenseNotice?: string
    message?: string
    provider?: "firecrawl"
    query?: string
    total?: number
  }
  errorText?: string
}

export type CapturePageScreenshotToolPart = {
  type: "tool-capturePageScreenshot"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    fullPage?: boolean
    url?: string
    viewportHeight?: number
    viewportWidth?: number
  }
  output?: {
    message?: string
    screenshot?: {
      fullPage: boolean
      provider: "firecrawl"
      sourceUrl: string
      storagePath: string
      url: string
      viewportHeight: number
      viewportWidth: number
    }
  }
  errorText?: string
}

export type SearchAssetsToolPart = {
  type: "tool-searchAssets"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    assetType?: "image" | "video" | "audio"
    category?: "character" | "scene" | "shorts" | "element"
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

export type SearchStockReferencesToolPart = {
  type: "tool-searchStockReferences"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    intent?: string
    lang?: string
    limit?: number
    mediaType?: "all" | "gif" | "sticker" | "image" | "video" | "audio"
    offset?: number
    provider?: "auto" | "giphy"
    query?: string
    rating?: "g" | "pg" | "pg-13" | "r"
  }
  output?: {
    attribution?: string
    licenseNotice?: string | null
    mediaType?: "all" | "gif" | "sticker" | "image" | "video" | "audio"
    message?: string
    provider?: "giphy"
    query?: string
    results?: Array<{
      attribution: string
      height?: number | null
      id: string
      licenseNotice?: string | null
      mediaType: "gif" | "sticker" | "image" | "video" | "audio"
      pageUrl: string
      previewUrl: string
      provider: "giphy"
      referenceImageUrl?: string | null
      referenceVideoUrl?: string | null
      thumbnailUrl: string
      title: string
      width?: number | null
    }>
    total?: number
  }
  errorText?: string
}

export type ListRecentGenerationsToolPart = {
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

export type ListAutomationsToolPart = {
  type: "tool-listAutomations"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  output?: {
    automations?: Array<{
      id: string
      name: string
      description?: string | null
      scheduleSummary?: string
      timezone?: string
      model?: string | null
      isActive?: boolean
      nextRunAt?: string
      lastRunAt?: string | null
      runCount?: number
      lastError?: string | null
      latestRun?: Record<string, unknown> | null
    }>
    message?: string
    total?: number
  }
  errorText?: string
}

export type ManageAutomationToolInput = {
  action: "create" | "update" | "pause" | "resume" | "run_now" | "delete"
  automationId?: string
  name?: string
  description?: string
  promptText?: string
  cronScheduleOrNaturalLanguage?: string
  timezone?: string
  model?: string
  isActive?: boolean
  refs?: Array<{
    id: string
    label: string
    category: "brand" | "asset"
  }>
  attachments?: Array<{
    url: string
    mediaType: string
    filename?: string
  }>
}

export type ManageAutomationToolSummary = {
  id: string
  name: string
  description?: string | null
  promptExcerpt?: string
  scheduleSummary?: string
  cronSchedule?: string
  timezone?: string
  model?: string | null
  isActive?: boolean
  nextRunAt?: string
}

export type ManageAutomationToolPart = {
  type: "tool-manageAutomation"
  toolCallId: string
  state:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "approval-responded"
    | "output-available"
    | "output-error"
    | "output-denied"
  input?: ManageAutomationToolInput
  output?: {
    action?: ManageAutomationToolInput["action"]
    automation?: ManageAutomationToolSummary
    deletedAutomationId?: string
    deletedAutomationName?: string
    message?: string
    runId?: string
    threadId?: string
  }
  approval?: {
    approved?: boolean
    id: string
    reason?: string
  }
  errorText?: string
}

export type ManageTemplateToolInput =
  | {
      action: "search"
      category?: "all" | "photo" | "video" | "slideshow"
      limit?: number
      query?: string
      scope?: "mine" | "public" | "all"
    }
  | {
      action: "get"
      slug?: string
      templateId?: string
    }
  | {
      action: "create"
      template: {
        category: "photo" | "video" | "slideshow"
        credits_cost?: number
        description?: string
        inputs: Array<Record<string, unknown>>
        output_kind: "image" | "video" | "audio" | "slideshow" | "mixed"
        prompt: string
        slug?: string
        thumbnail_kind?: "image" | "video"
        thumbnail_url?: string | null
        tips?: string | null
        title: string
        visibility?: "private" | "public"
      }
    }
  | {
      action: "update"
      changes: Record<string, unknown>
      templateId: string
    }

export type ManageTemplateToolSummary = {
  category: string
  creatorId?: string
  description?: string | null
  editUrl: string
  id: string
  isOwner?: boolean
  outputKind: string
  prompt?: string
  runUrl: string
  slug: string
  thumbnailKind?: "image" | "video"
  thumbnailUrl?: string | null
  tips?: string | null
  title: string
  updatedAt: string
  visibility: string
  inputs?: Array<Record<string, unknown>>
  creditsCost?: number
}

export type ManageTemplateToolPart = {
  type: "tool-manageTemplate"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: ManageTemplateToolInput
  output?: {
    action?: ManageTemplateToolInput["action"]
    message?: string
    status?: "ok" | "error"
    template?: ManageTemplateToolSummary
    templates?: ManageTemplateToolSummary[]
    total?: number
  }
  errorText?: string
}

export type ListThreadMediaToolPart = {
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

export type ExtractVideoFramesToolPart = {
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

export type ComposeTimelineVideoToolPart = {
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

export type SaveGenerationAsAssetToolPart = {
  type: "tool-saveGenerationAsAsset"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    assetId?: string
    category?: "character" | "scene" | "shorts" | "element"
    confirmed?: boolean
    description?: string
    generationId?: string
    mediaId?: string
    tags?: string[]
    title?: string
    uploadId?: string
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
      sourceUploadId?: string | null
      tags: string[]
      thumbnailUrl?: string | null
      title: string
      url: string
      visibility: "private" | "public"
    }
    message?: string
    updated?: boolean
  }
  errorText?: string
}

export type GetBrandContextToolPart = {
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

export type SocialProvider = "instagram" | "tiktok"

export type SocialConnectionToolSummary = {
  accountType?: string | null
  displayName?: string | null
  id: string
  instagramConnectionId?: string | null
  instagramUserId?: string | null
  profileFetchedAt?: string | null
  provider: SocialProvider
  scopes?: string[]
  status: string
  tokenExpiresAt?: string | null
  updatedAt: string
  username?: string | null
}

export type ListSocialConnectionsToolPart = {
  type: "tool-listSocialConnections"
  toolCallId: string
  state:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "approval-responded"
    | "output-available"
    | "output-error"
    | "output-denied"
  input?: {
    provider?: SocialProvider
  }
  output?: {
    connections?: SocialConnectionToolSummary[]
    message?: string
    provider?: SocialProvider | null
    total?: number
  }
  errorText?: string
}

export type ListInstagramConnectionsToolPart = {
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

export type PrepareInstagramPostToolInput = {
  action: "draft" | "publish" | "schedule"
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

export type PrepareInstagramPostToolPart = {
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
    action: "draft" | "publish" | "schedule"
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

export type PrepareSocialPostToolInput =
  | {
      provider: "instagram"
      action: "draft" | "publish" | "schedule"
      caption?: string
      carouselItems?: Array<{
        kind: "image" | "video"
        url: string
      }>
      connectionId: string
      coverUrl?: string
      mediaType: "image" | "feed_video" | "reel" | "carousel" | "story"
      mediaUrl?: string
      scheduledAt?: string
      shareToFeed?: boolean
      storyAssetKind?: "image" | "video"
      trialParams?: {
        graduationStrategy: "MANUAL" | "SS_PERFORMANCE"
      }
    }
  | {
      provider: "tiktok"
      action: "draft" | "publish" | "schedule"
      autoAddMusic?: boolean
      brandContentToggle?: boolean
      brandOrganicToggle?: boolean
      caption?: string
      connectionId: string
      description?: string
      disableComment?: boolean
      disableDuet?: boolean
      disableStitch?: boolean
      isAigc?: boolean
      mediaUrl?: string
      mode: "upload" | "direct"
      photoCoverIndex?: number
      photoItems?: string[]
      postType?: "video" | "photo"
      privacyLevel?: string
      scheduledAt?: string
    }

export type PrepareSocialPostToolPart = {
  type: "tool-prepareSocialPost"
  toolCallId: string
  state:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "approval-responded"
    | "output-available"
    | "output-error"
    | "output-denied"
  input?: PrepareSocialPostToolInput
  output?: {
    action: "draft" | "publish" | "schedule"
    account?: SocialConnectionToolSummary
    message?: string
    post?: {
      caption?: string | null
      createdAt: string
      id: string
      instagramConnectionId?: string | null
      mediaType: string
      mediaUrl: string
      metadata?: {
        assetKind?: "image" | "video"
        carouselItems?: Array<{
          kind: "image" | "video"
          url: string
        }>
        tiktok?: {
          description?: string | null
          photoCoverIndex?: number
          photoItems?: Array<{ url: string }>
        }
      } | null
      scheduledAt?: string | null
      socialConnectionId?: string | null
      status: string
    }
    provider: SocialProvider
  }
  approval?: {
    approved?: boolean
    id: string
    reason?: string
  }
  errorText?: string
}

export type SaveSkillToolPart = {
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

export type ActivateSkillToolPart = {
  type: "tool-activateSkill"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    slug?: string
  }
  output?: {
    isMine?: boolean
    message?: string
    name?: string
    slug?: string
    status?: "not-found" | "ok" | "parse-error"
    title?: string | null
  }
  errorText?: string
}

export type AwaitGenerationToolPart = {
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

export type ScheduleGenerationFollowUpToolPart = {
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

export type DownloadSocialReferenceToolPart = {
  type: "tool-downloadSocialReference"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    url?: string
  }
  output?: {
    jobId?: string
    message?: string
    outputMediaKind?: "slideshow" | "video" | null
    outputPublicUrl?: string | null
    outputPublicUrls?: string[]
    sourcePlatform?: "instagram" | "tiktok"
  }
  errorText?: string
}

export type AnalyzeMediaToolPart = {
  type: "tool-analyzeMedia"
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: {
    focus?: "general" | "prompt_pack" | "recreation" | "style"
    mediaIds?: string[]
    referenceIds?: string[]
  }
  output?: {
    analysis?: {
      colorPalette?: string[]
      composition?: string
      lighting?: string
      mood?: string
      promptPack?: {
        editDescription?: Record<string, string>
        imageDescription?: Record<string, string>
        masterPrompt?: string
      }
      recreationGuidance?: {
        changeable?: string[]
        preserve?: string[]
        suggestedWorkflow?: string
      }
      styleNotes?: string
      subjects?: string[]
      summary?: string
      visibleText?: string[]
    }
    analyzedUrls?: string[]
    focus?: "general" | "prompt_pack" | "recreation" | "style"
    imageCount?: number
    mediaKind?: "image" | "slideshow"
    message?: string
    summary?: string
    warnings?: string[]
  }
  errorText?: string
}

export type ComposerUploadAttachment = {
  file: File
  id: string
  isUploading: boolean
  source: "upload"
  uploadedUrl?: string
}

export type ComposerAssetAttachment = {
  assetType: "image" | "video" | "audio"
  id: string
  ref: AttachedRef
  source: "asset"
  title: string
  url: string
}

export type ComposerAttachment = ComposerUploadAttachment | ComposerAssetAttachment
