"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { FunnelSimple, Image as ImageIcon, Video, X } from "@phosphor-icons/react"
import { toast } from "sonner"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { TemplateRunForm } from "@/components/templates/template-run-form"
import {
  TemplateInputField,
  type TemplateFieldValue,
} from "@/components/templates/template-input-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import type { AssetCategory, AssetType } from "@/lib/assets/types"
import type { SavedExample } from "@/lib/examples/types"
import { DEFAULT_IMAGE_MODEL_IDENTIFIER } from "@/lib/constants/models"
import { saveImageGenerationIntent } from "@/lib/image/image-generation-intent"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import type { Template, TemplateCategory } from "@/lib/templates/types"
import { getDefaultInputValue, isMediaInputKind } from "@/lib/templates/validation"
import { saveVideoGenerationIntent } from "@/lib/video/video-generation-intent"
import { cn } from "@/lib/utils"

type ExploreMediaType = "image" | "video"
const EXPLORE_CARD_IMAGE_SIZES =
  "(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
const EXPLORE_MODAL_IMAGE_SIZES = "(min-width: 1024px) 50vw, 100vw"

type ExampleAssetModalTarget = {
  inputId: string
  inputKind: "image" | "video" | "audio"
}

type ExploreItem =
  | {
      id: string
      kind: "template"
      title: string
      mediaUrl: string
      mediaKind: "image" | "video"
      fallbackAspectRatio: number
      updatedAt: string
      template: Template
    }
  | {
      id: string
      kind: "example"
      title: string
      mediaUrl: string
      mediaKind: "image" | "video"
      fallbackAspectRatio: number
      updatedAt: string
      example: SavedExample
    }

interface ExplorePageProps {
  initialTemplates: Template[]
  initialExamples: SavedExample[]
}

const MEDIA_OPTIONS: Array<{ value: ExploreMediaType; label: string; icon: React.ElementType }> = [
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "video", label: "Video", icon: Video },
]
const EXPLORE_ASPECT_RATIO_CACHE_KEY = "unican:explore-media-aspect-ratios"
const DEFAULT_IMAGE_ASPECT_RATIO = 4 / 5
const DEFAULT_VIDEO_ASPECT_RATIO = 9 / 16

function mediaTypeToTemplateCategory(mediaType: ExploreMediaType): TemplateCategory {
  return mediaType === "video" ? "video" : "photo"
}

function mediaTypeToExampleSurface(mediaType: ExploreMediaType) {
  return mediaType === "video" ? "video" : "image"
}

function getAssetModalConfigForInputKind(inputKind: "image" | "video" | "audio"): {
  presetCategory?: AssetCategory
  allowedAssetTypes?: AssetType[]
} {
  switch (inputKind) {
    case "image":
      return { presetCategory: "character", allowedAssetTypes: ["image"] }
    case "video":
      return { presetCategory: "shorts", allowedAssetTypes: ["video"] }
    case "audio":
      return { allowedAssetTypes: ["audio"] }
    default:
      return {}
  }
}

function parseAspectRatio(value: unknown): number | null {
  if (typeof value !== "string") return null
  const match = value.trim().match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
  if (!match) return null

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }

  return width / height
}

function clampAspectRatio(ratio: number) {
  if (!Number.isFinite(ratio) || ratio <= 0) return null
  return Math.min(3, Math.max(1 / 3, ratio))
}

function getTemplateFallbackAspectRatio(template: Template) {
  for (const input of template.inputs) {
    if (input.kind !== "aspect_ratio" || !input.default || input.default === "auto") continue

    const parsed = parseAspectRatio(input.default)
    if (parsed) return parsed
  }

  return template.thumbnail_kind === "video" ? DEFAULT_VIDEO_ASPECT_RATIO : DEFAULT_IMAGE_ASPECT_RATIO
}

function getExampleFallbackAspectRatio(example: SavedExample) {
  const parsed = parseAspectRatio(example.default_settings.aspect_ratio)
  if (parsed) return parsed
  return example.cover_kind === "video" ? DEFAULT_VIDEO_ASPECT_RATIO : DEFAULT_IMAGE_ASPECT_RATIO
}

function getAspectRatioCacheKey(item: ExploreItem) {
  return `${item.id}:${item.mediaUrl}`
}

function loadAspectRatioCache(): Record<string, number> {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(EXPLORE_ASPECT_RATIO_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, typeof value === "number" ? clampAspectRatio(value) : null])
        .filter((entry): entry is [string, number] => typeof entry[1] === "number"),
    )
  } catch {
    return {}
  }
}

function saveAspectRatioCache(cache: Record<string, number>) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(EXPLORE_ASPECT_RATIO_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Best effort only; layout should still work without persistent media metadata.
  }
}

function normalizeItems(templates: Template[], examples: SavedExample[]): ExploreItem[] {
  const templateItems: ExploreItem[] = templates
    .filter((template) => Boolean(template.thumbnail_url))
    .map((template) => ({
      id: `template-${template.id}`,
      kind: "template",
      title: template.title,
      mediaUrl: template.thumbnail_url as string,
      mediaKind: template.thumbnail_kind,
      fallbackAspectRatio: getTemplateFallbackAspectRatio(template),
      updatedAt: template.updated_at,
      template,
    }))

  const exampleItems: ExploreItem[] = examples
    .filter((example) => Boolean(example.cover_url))
    .map((example) => ({
      id: `example-${example.id}`,
      kind: "example",
      title: example.title,
      mediaUrl: example.cover_url as string,
      mediaKind: example.cover_kind,
      fallbackAspectRatio: getExampleFallbackAspectRatio(example),
      updatedAt: example.updated_at,
      example,
    }))

  return [...templateItems, ...exampleItems].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

function buildInitialExampleValues(example: SavedExample): Record<string, TemplateFieldValue> {
  const values: Record<string, TemplateFieldValue> = {}
  for (const input of example.inputs) {
    values[input.id] = isMediaInputKind(input.kind) ? null : getDefaultInputValue(input)
  }
  return values
}

function resolveTextPrompt(prompt: string, values: Record<string, TemplateFieldValue>) {
  let resolved = prompt
  for (const [id, value] of Object.entries(values)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      resolved = resolved.replace(new RegExp(`\\{\\{${id}\\}\\}`, "g"), String(value))
    }
  }
  return resolved
}

async function resolveMediaInputUrls(
  example: SavedExample,
  values: Record<string, TemplateFieldValue>,
) {
  const urlsByInputId: Record<string, string> = {}

  for (const input of example.inputs) {
    if (!isMediaInputKind(input.kind)) continue

    const value = values[input.id]
    if (value instanceof File) {
      const uploaded = await uploadFileToSupabase(value, "example-inputs")
      if (!uploaded?.url) {
        throw new Error(`Failed to upload ${input.label}`)
      }
      urlsByInputId[input.id] = uploaded.url
    } else if (typeof value === "string" && /^https?:\/\//i.test(value)) {
      urlsByInputId[input.id] = value
    }
  }

  return urlsByInputId
}

function buildOrderedReferenceUrls(
  example: SavedExample,
  mediaUrlsByInputId: Record<string, string>,
) {
  const ordered = example.default_settings.reference_media_order
  const urls: string[] = []

  if (Array.isArray(ordered)) {
    for (const item of ordered) {
      if (!item || typeof item !== "object") continue
      if (item.type === "attachment" && typeof item.url === "string") {
        urls.push(item.url)
      }
      if (item.type === "input" && typeof item.id === "string" && mediaUrlsByInputId[item.id]) {
        urls.push(mediaUrlsByInputId[item.id])
      }
    }
  }

  if (urls.length === 0) {
    urls.push(...example.prompt_attachments.map((attachment) => attachment.url))
    urls.push(...Object.values(mediaUrlsByInputId))
  }

  return [...new Set(urls.filter((url) => /^https?:\/\//i.test(url)))]
}

function ExploreMedia({
  item,
  onAspectRatio,
}: {
  item: ExploreItem
  onAspectRatio: (ratio: number) => void
}) {
  if (item.mediaKind === "video") {
    return (
      <video
        src={item.mediaUrl}
        className="absolute inset-0 h-full w-full object-contain"
        muted
        playsInline
        loop
        autoPlay
        preload="metadata"
        onLoadedMetadata={(event) => {
          const target = event.currentTarget
          const ratio = clampAspectRatio(target.videoWidth / target.videoHeight)
          if (ratio) onAspectRatio(ratio)
        }}
      />
    )
  }

  return (
    <Image
      src={item.mediaUrl}
      alt=""
      fill
      sizes={EXPLORE_CARD_IMAGE_SIZES}
      className="object-contain"
      onLoad={(event) => {
        const target = event.currentTarget
        const ratio = clampAspectRatio(target.naturalWidth / target.naturalHeight)
        if (ratio) onAspectRatio(ratio)
      }}
    />
  )
}

function ExploreCard({
  item,
  aspectRatio,
  onAspectRatio,
  onOpen,
}: {
  item: ExploreItem
  aspectRatio: number
  onAspectRatio: (item: ExploreItem, ratio: number) => void
  onOpen: (item: ExploreItem) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group mb-4 block w-full break-inside-avoid overflow-hidden rounded-lg bg-muted text-left outline-none ring-offset-background transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div
        className="relative w-full overflow-hidden bg-muted"
        style={{ aspectRatio: String(aspectRatio) }}
      >
        <ExploreMedia item={item} onAspectRatio={(ratio) => onAspectRatio(item, ratio)} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 px-4 text-center opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">
            {item.title}
          </p>
          <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black shadow-sm">
            {item.kind === "template" ? "Use Template" : "Use Example"}
          </span>
        </div>
      </div>
    </button>
  )
}

function TemplateModal({
  template,
  open,
  onOpenChange,
}: {
  template: Template | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(98vw,1800px)] !max-w-[min(98vw,1800px)] max-h-[94vh] overflow-hidden rounded-3xl p-0">
        {template ? (
          <div className="grid max-h-[92vh] min-h-0 gap-0 lg:grid-cols-2">
            <div className="relative flex min-h-[220px] items-center justify-center bg-black lg:min-h-[640px]">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 z-10 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X className="size-4" weight="bold" />
              </Button>
              {template.thumbnail_kind === "video" ? (
                <video
                  src={template.thumbnail_url ?? ""}
                  className="max-h-[42vh] w-auto max-w-full lg:max-h-[86vh]"
                  muted
                  playsInline
                  loop
                  autoPlay
                />
              ) : template.thumbnail_url ? (
                <Image
                  src={template.thumbnail_url}
                  alt=""
                  fill
                  sizes={EXPLORE_MODAL_IMAGE_SIZES}
                  className="object-contain"
                />
              ) : (
                <div className="h-full w-full bg-muted" />
              )}
            </div>
            <div className="min-h-0 space-y-5 overflow-y-auto p-5 sm:p-6 lg:p-8">
              <DialogHeader>
                <DialogTitle className="text-xl">{template.title}</DialogTitle>
                {template.description ? (
                  <DialogDescription>{template.description}</DialogDescription>
                ) : null}
              </DialogHeader>
              <TemplateRunForm template={template} compactDesktop />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ExampleModal({
  example,
  open,
  onOpenChange,
}: {
  example: SavedExample | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [draftPrompt, setDraftPrompt] = React.useState("")
  const [values, setValues] = React.useState<Record<string, TemplateFieldValue>>({})
  const [previewUrls, setPreviewUrls] = React.useState<Record<string, string | null>>({})
  const [mediaLabelsByInputId, setMediaLabelsByInputId] = React.useState<Record<string, string>>({})
  const [assetModalTarget, setAssetModalTarget] = React.useState<ExampleAssetModalTarget | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!example || !open) return
    setDraftPrompt(example.prompt)
    setValues(buildInitialExampleValues(example))
    setPreviewUrls({})
    setMediaLabelsByInputId({})
    setAssetModalTarget(null)
  }, [example, open])

  React.useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach((url) => {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url)
      })
    }
  }, [previewUrls])

  const setFieldValue = React.useCallback((id: string, value: TemplateFieldValue) => {
    setValues((current) => ({ ...current, [id]: value }))
    setMediaLabelsByInputId((current) => {
      if (!(id in current)) return current
      const next = { ...current }
      delete next[id]
      return next
    })
    setPreviewUrls((current) => {
      const previous = current[id]
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous)

      if (value instanceof File) {
        return { ...current, [id]: URL.createObjectURL(value) }
      }
      if (typeof value === "string" && /^https?:\/\//i.test(value)) {
        return { ...current, [id]: value }
      }
      return { ...current, [id]: null }
    })
  }, [])

  const handleAssetSelect = React.useCallback(
    (pick: AssetSelectionPick) => {
      if (!assetModalTarget) return

      if (pick.assetType !== assetModalTarget.inputKind) {
        toast.error(`Selected asset must be a ${assetModalTarget.inputKind}`)
        return
      }

      setValues((current) => ({ ...current, [assetModalTarget.inputId]: pick.url }))
      setPreviewUrls((current) => {
        const previous = current[assetModalTarget.inputId]
        if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous)
        return { ...current, [assetModalTarget.inputId]: pick.previewUrl ?? pick.url }
      })
      setMediaLabelsByInputId((current) => ({
        ...current,
        [assetModalTarget.inputId]: pick.title?.trim() || `${pick.assetType} asset`,
      }))
      setAssetModalTarget(null)
    },
    [assetModalTarget],
  )

  const handleUseExample = React.useCallback(async () => {
    if (!example) return

    for (const input of example.inputs) {
      const value = values[input.id]
      if (input.required && (value === null || value === undefined || value === "")) {
        toast.error(`${input.label} is required`)
        return
      }
    }

    setIsSubmitting(true)
    try {
      const mediaUrlsByInputId = await resolveMediaInputUrls(example, values)
      const resolvedPrompt = resolveTextPrompt(draftPrompt, values)
      const referenceUrls = buildOrderedReferenceUrls(example, mediaUrlsByInputId)

      if (example.surface === "video") {
        const videoInput = example.inputs.find(
          (input) => input.kind === "video" && mediaUrlsByInputId[input.id],
        )
        const imageInput = example.inputs.find(
          (input) => input.kind === "image" && mediaUrlsByInputId[input.id],
        )
        const audioInput = example.inputs.find(
          (input) => input.kind === "audio" && mediaUrlsByInputId[input.id],
        )

        saveVideoGenerationIntent({
          prompt: resolvedPrompt,
          negativePrompt: "",
          attachedRefs: [],
          model: typeof example.default_settings.model === "string" ? example.default_settings.model : "",
          parameters:
            example.default_settings.model_parameters &&
            typeof example.default_settings.model_parameters === "object" &&
            !Array.isArray(example.default_settings.model_parameters)
              ? example.default_settings.model_parameters
              : {},
          multiShotMode: false,
          multiShotShots: [],
          inputImageUrl: imageInput ? mediaUrlsByInputId[imageInput.id] : null,
          lastFrameImageUrl: null,
          inputVideoUrl: videoInput ? mediaUrlsByInputId[videoInput.id] : null,
          inputAudioUrl: audioInput ? mediaUrlsByInputId[audioInput.id] : null,
          referenceImageUrls: referenceUrls.filter((url) => url !== (videoInput ? mediaUrlsByInputId[videoInput.id] : null)),
        })
        router.push("/video?generate=1")
        return
      }

      saveImageGenerationIntent({
        prompt: resolvedPrompt,
        attachedRefs: [],
        referenceImageUrls: referenceUrls,
        enhancePrompt: example.default_settings.enhance_prompt === true,
        model:
          typeof example.default_settings.model === "string"
            ? example.default_settings.model
            : DEFAULT_IMAGE_MODEL_IDENTIFIER,
        aspectRatio:
          typeof example.default_settings.aspect_ratio === "string"
            ? example.default_settings.aspect_ratio
            : "match_input_image",
        numImages:
          typeof example.default_settings.num_images === "number" &&
          Number.isFinite(example.default_settings.num_images)
            ? Math.max(1, Math.floor(example.default_settings.num_images))
            : 1,
      })
      router.push("/image?generate=1")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not use example")
    } finally {
      setIsSubmitting(false)
    }
  }, [draftPrompt, example, router, values])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(98vw,1800px)] !max-w-[min(98vw,1800px)] max-h-[94vh] overflow-hidden rounded-3xl p-0">
        {example ? (
          <div className="grid max-h-[92vh] min-h-0 gap-0 lg:grid-cols-2">
            <div className="relative flex min-h-[220px] items-center justify-center bg-black lg:min-h-[640px]">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 z-10 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X className="size-4" weight="bold" />
              </Button>
              {example.cover_kind === "video" ? (
                <video
                  src={example.cover_url ?? ""}
                  className="max-h-[42vh] w-auto max-w-full lg:max-h-[86vh]"
                  muted
                  playsInline
                  loop
                  autoPlay
                />
              ) : example.cover_url ? (
                <Image
                  src={example.cover_url}
                  alt=""
                  fill
                  sizes={EXPLORE_MODAL_IMAGE_SIZES}
                  className="object-contain"
                />
              ) : (
                <div className="h-full w-full bg-muted" />
              )}
            </div>
            <div className="flex min-h-0 flex-col bg-background">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6 lg:p-8">
                <DialogHeader>
                  <DialogTitle className="text-xl lg:text-2xl">{example.title}</DialogTitle>
                  {example.description ? (
                    <DialogDescription>{example.description}</DialogDescription>
                  ) : null}
                </DialogHeader>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Prompt
                  </label>
                  <Textarea
                    value={draftPrompt}
                    onChange={(event) => setDraftPrompt(event.target.value)}
                    className="min-h-40 lg:min-h-56"
                  />
                </div>

                {example.inputs.length > 0 ? (
                  <div className="space-y-4">
                    {example.inputs.map((input) => {
                      const isMediaInput =
                        input.kind === "image" || input.kind === "video" || input.kind === "audio"

                      return (
                        <TemplateInputField
                          key={input.id}
                          input={input}
                          value={values[input.id] ?? null}
                          previewUrl={previewUrls[input.id] ?? null}
                          mediaLabel={mediaLabelsByInputId[input.id] ?? null}
                          disabled={isSubmitting}
                          compactDesktop
                          onChange={(value) => setFieldValue(input.id, value)}
                          onOpenMediaAssetPicker={
                            isSubmitting || !isMediaInput
                              ? undefined
                              : () =>
                                  setAssetModalTarget({
                                    inputId: input.id,
                                    inputKind: input.kind,
                                  })
                          }
                        />
                      )
                    })}
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-border/60 bg-background/95 p-4 backdrop-blur sm:p-5 lg:p-6">
                <Button
                  type="button"
                  className="h-11 w-full"
                  disabled={isSubmitting}
                  onClick={() => void handleUseExample()}
                >
                  {isSubmitting ? "Preparing..." : "Use Example"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
      </Dialog>

      <AssetSelectionModal
        open={assetModalTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setAssetModalTarget(null)
        }}
        onSelect={handleAssetSelect}
        {...(assetModalTarget ? getAssetModalConfigForInputKind(assetModalTarget.inputKind) : {})}
      />
    </>
  )
}

export function ExplorePage({ initialTemplates, initialExamples }: ExplorePageProps) {
  const [mediaType, setMediaType] = React.useState<ExploreMediaType>("image")
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [templates, setTemplates] = React.useState<Template[]>(initialTemplates)
  const [examples, setExamples] = React.useState<SavedExample[]>(initialExamples)
  const [aspectRatios, setAspectRatios] = React.useState<Record<string, number>>({})
  const [loading, setLoading] = React.useState(false)
  const [selectedTemplate, setSelectedTemplate] = React.useState<Template | null>(null)
  const [selectedExample, setSelectedExample] = React.useState<SavedExample | null>(null)

  React.useEffect(() => {
    setAspectRatios(loadAspectRatioCache())
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [search])

  React.useEffect(() => {
    const controller = new AbortController()

    async function loadExploreItems() {
      setLoading(true)
      try {
        const templateParams = new URLSearchParams({
          category: mediaTypeToTemplateCategory(mediaType),
        })
        const exampleParams = new URLSearchParams({
          surface: mediaTypeToExampleSurface(mediaType),
        })
        if (debouncedSearch) {
          templateParams.set("search", debouncedSearch)
          exampleParams.set("search", debouncedSearch)
        }

        const [templatesResponse, examplesResponse] = await Promise.all([
          fetch(`/api/templates?${templateParams.toString()}`, { signal: controller.signal }),
          fetch(`/api/examples?${exampleParams.toString()}`, { signal: controller.signal }),
        ])

        if (!templatesResponse.ok || !examplesResponse.ok) {
          throw new Error("Failed to load explore items")
        }

        const [templatesPayload, examplesPayload] = await Promise.all([
          templatesResponse.json() as Promise<{ templates?: Template[] }>,
          examplesResponse.json() as Promise<{ examples?: SavedExample[] }>,
        ])

        setTemplates(templatesPayload.templates ?? [])
        setExamples(examplesPayload.examples ?? [])
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[explore] failed to load:", error)
          setTemplates([])
          setExamples([])
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadExploreItems()

    return () => controller.abort()
  }, [debouncedSearch, mediaType])

  const items = React.useMemo(() => normalizeItems(templates, examples), [templates, examples])
  const activeMediaOption = MEDIA_OPTIONS.find((option) => option.value === mediaType) ?? MEDIA_OPTIONS[0]

  const handleOpenItem = React.useCallback((item: ExploreItem) => {
    if (item.kind === "template") {
      setSelectedTemplate(item.template)
      return
    }
    setSelectedExample(item.example)
  }, [])

  const handleAspectRatio = React.useCallback((item: ExploreItem, ratio: number) => {
    const key = getAspectRatioCacheKey(item)
    setAspectRatios((current) => {
      if (Math.abs((current[key] ?? 0) - ratio) < 0.001) return current

      const next = { ...current, [key]: ratio }
      saveAspectRatioCache(next)
      return next
    })
  }, [])

  return (
    <div className="w-full px-4 pb-10 pt-[52px]">
      <header className="sticky top-[52px] z-20 mb-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-background/95 py-3 backdrop-blur supports-backdrop-filter:bg-background/60">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Explore</h1>

        <div className="mx-auto w-full max-w-xl">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            className="h-10 rounded-full border-border/70 bg-muted/35 text-center"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-10 rounded-full px-3 sm:px-4">
              <FunnelSimple className="size-4" weight="bold" />
              <span className="hidden sm:inline">{activeMediaOption.label}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-40 space-y-1 p-1.5">
            {MEDIA_OPTIONS.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMediaType(option.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                    mediaType === option.value
                      ? "bg-foreground text-background"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" weight="bold" />
                  {option.label}
                </button>
              )
            })}
          </PopoverContent>
        </Popover>
      </header>

      {items.length > 0 ? (
        <section
          className={cn(
            "columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4",
            loading && "opacity-60",
          )}
        >
          {items.map((item) => (
            <ExploreCard
              key={item.id}
              item={item}
              aspectRatio={aspectRatios[getAspectRatioCacheKey(item)] ?? item.fallbackAspectRatio}
              onAspectRatio={handleAspectRatio}
              onOpen={handleOpenItem}
            />
          ))}
        </section>
      ) : (
        <div className="flex min-h-[45vh] items-center justify-center text-sm text-muted-foreground">
          {loading ? "Loading..." : "No media found."}
        </div>
      )}

      <TemplateModal
        template={selectedTemplate}
        open={selectedTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTemplate(null)
        }}
      />
      <ExampleModal
        example={selectedExample}
        open={selectedExample !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedExample(null)
        }}
      />
    </div>
  )
}
