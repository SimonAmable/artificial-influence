"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  Plus,
  Trash,
  UploadSimple,
  ArrowsClockwise,
  Sparkle,
  Info,
  X,
  GenderFemale,
  GenderMale,
  Globe,
  Eye,
  User,
  Shuffle,
  FileImage,
  DownloadSimple
} from "@phosphor-icons/react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { GenerationLoadingSlots } from "@/components/shared/display/generation-loading-slots"
import { cn } from "@/lib/utils"
import { generateImageAndWait, isInsufficientCreditsError, isInsufficientCreditsMessage } from "@/lib/generate-image-client"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { downloadMediaFile, normalizeMediaModelName } from "@/components/shared/display/media-viewer-utils"
import { toast } from "sonner"
import { showCreditsUpsellToast } from "@/lib/pricing-upsell"

interface ImageHistoryItem {
  id: string
  url: string
  model: string | null
  prompt: string | null
  displayName?: string | null
  trackedPills?: string[]
  tool: string | null
  aspectRatio: string | null
  type: string | null
  createdAt: string | null
  reference_image_urls?: string[]
}

const EYE_COLORS: { [key: string]: string } = {
  Brown: "radial-gradient(circle, #5c3a21 0%, #1e1108 80%)",
  Blue: "radial-gradient(circle, #2d82b7 0%, #0c2b3e 80%)",
  Green: "radial-gradient(circle, #2a8a5a 0%, #0d2f1f 80%)",
  Amber: "radial-gradient(circle, #b7791f 0%, #3a2202 80%)",
  Grey: "radial-gradient(circle, #7e8a97 0%, #2f363f 80%)",
  Black: "radial-gradient(circle, #222222 0%, #000000 80%)",
  Purple: "radial-gradient(circle, #7b2cbf 0%, #240046 80%)",
  White: "radial-gradient(circle, #e2e8f0 0%, #475569 80%)",
  Red: "radial-gradient(circle, #b91c1c 0%, #450a0a 80%)"
}

const SKIN_TONES: { [key: string]: string } = {
  Fair: "#fae7d5",
  Light: "#f1c27d",
  Olive: "#d5a153",
  Tan: "#b87d31",
  "Deep brown": "#6c4013",
  Dark: "#3c2005"
}

const HAIR_COLORS: { [key: string]: string } = {
  Blonde: "#fdf3cd",
  Brunette: "#5a3a22",
  Black: "#1c1c1c",
  Red: "#cf4a24",
  Grey: "#94a3b8",
  White: "#fafafa",
  Pink: "#fb7185",
  Blue: "#3b82f6",
  Green: "#10b981"
}

function getCharacterDisplayName(item: ImageHistoryItem | null): string {
  const explicitName = item?.displayName?.trim()
  if (explicitName) return explicitName

  const prompt = item?.prompt?.trim()
  if (!prompt) return "Saved Character"

  try {
    const parsed = JSON.parse(prompt) as unknown
    const jsonName = findCharacterDisplayNameInJson(parsed)
    if (jsonName) {
      return jsonName
    }
  } catch {
    // Fallback to prompt heuristics below.
  }

  const namedMatch = prompt.match(/named\s+([^.,]+?)(?:\.|,|$)/i)
  if (namedMatch?.[1]) {
    return namedMatch[1].trim()
  }

  if (prompt.length <= 24) {
    return prompt
  }

  return prompt.split(".")[0]?.trim() || "Saved Character"
}

function findCharacterDisplayNameInJson(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const getStringField = (keys: string[]) => {
    for (const key of keys) {
      const entry = record[key]
      if (typeof entry === "string" && entry.trim()) {
        return entry.trim()
      }
    }
    return null
  }

  const directName =
    getStringField(["displayName", "displayname", "character_name", "title", "name"]) ??
    getStringField(["subject", "main_subject"])
  if (directName) {
    return directName
  }

  const promptString = getStringField(["prompt"])
  if (promptString) {
    const namedMatch = promptString.match(/named\s+([^.,]+?)(?:\.|,|$)/i)
    if (namedMatch?.[1]) {
      return namedMatch[1].trim()
    }
  }

  const imageDescription = record.image_description
  if (imageDescription && typeof imageDescription === "object" && !Array.isArray(imageDescription)) {
    const imageDescriptionRecord = imageDescription as Record<string, unknown>
    const imageDescriptionString = (keys: string[]) => {
      for (const key of keys) {
        const entry = imageDescriptionRecord[key]
        if (typeof entry === "string" && entry.trim()) {
          return entry.trim()
        }
      }
      return null
    }

    return imageDescriptionString(["displayName", "displayname", "character_name", "subject", "main_subject"])
  }

  return null
}

function getCharacterDownloadName(item: ImageHistoryItem | null): string {
  const name = getCharacterDisplayName(item)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return name || "ai-influencer"
}

function buildCharacterAssetTags(
  selectedTraits: Record<string, string>,
  model: string | null,
  isDirectSave: boolean
): string[] {
  const tags = new Set<string>(["character", "AI Influencer"])

  Object.values(selectedTraits).forEach((value) => {
    const tag = value.trim()
    if (tag) tags.add(tag)
  })

  if (model && model !== "upload") {
    tags.add(normalizeMediaModelName(model))
  }

  tags.add(isDirectSave ? "Saved Reference" : "AI Generated")

  return Array.from(tags)
}

function buildCharacterGenerationPrompt(
  name: string,
  selectedTraits: Record<string, string>,
  hasMultipleReferences: boolean
): string {
  const traitsPrompt = Object.entries(selectedTraits)
    .map(([key, val]) => `${key}: ${val}`)
    .join(", ")

  let prompt = `A candid iPhone 17 selfie of an AI influencer named ${name}, captured with natural handheld framing, authentic front-camera realism, soft flash, and polished creator energy`

  if (traitsPrompt) {
    prompt += `. Features: ${traitsPrompt}`
  }

  if (hasMultipleReferences) {
    prompt += `. Blend characteristics and facial structures from the reference images into one consistent identity while keeping the candid selfie feel`
  }

  return prompt
}

const CUSTOM_TRAIT_IMAGE = "/ai_influencer/custom_question_mark_icon.png"

const TRAIT_ARTWORK = {
  gender: {
    options: {
      Female: "/ai_influencer/gender/female.png",
      Male: "/ai_influencer/gender/male.png"
    },
  },
  race: {
    options: {
      African: "/ai_influencer/race/african.png",
      Latina: "/ai_influencer/race/latina (2).png",
      "Middle Eastern": "/ai_influencer/race/middle_eastern.png",
      Mixed: "/ai_influencer/race/mixed.png",
      "South Asian": "/ai_influencer/race/south_asian.png",
      White: "/ai_influencer/race/white.png"
    },
  }
} as const

const TRAITS = {
  gender: {
    label: "Gender",
    icon: GenderFemale,
    options: ["Female", "Male"],
    columns: "grid-cols-3"
  },
  race: {
    label: "Race",
    icon: Globe,
    options: ["African", "Latina", "Middle Eastern", "Mixed", "South Asian", "White"],
    columns: "grid-cols-3"
  },
  eyeColour: {
    label: "Eye colour",
    icon: Eye,
    options: ["Brown", "Blue", "Green", "Amber", "Grey", "Black", "Purple", "White", "Red"],
    columns: "grid-cols-3"
  },
  age: {
    label: "Age",
    icon: User,
    options: ["Adult", "Mature", "Senior"],
    columns: "grid-cols-3"
  },
  bodyType: {
    label: "Body type",
    icon: User,
    options: ["Slim", "Lean", "Athletic", "Muscular", "Curvy", "Heavy", "Skinny"],
    columns: "grid-cols-3"
  },
  skinTone: {
    label: "Skin tone",
    icon: Globe,
    options: ["Fair", "Light", "Olive", "Tan", "Deep brown", "Dark"],
    columns: "grid-cols-3"
  },
  hairColour: {
    label: "Hair colour",
    icon: Sparkle,
    options: ["Blonde", "Brunette", "Black", "Red", "Grey", "White", "Pink", "Blue", "Green"],
    columns: "grid-cols-3"
  },
  hairStyle: {
    label: "Hair style",
    icon: Sparkle,
    options: ["Long waves", "Straight", "Bob", "Bun", "Ponytail", "Curly", "Pixie"],
    columns: "grid-cols-2"
  }
}

function LiquidGlassCard({
  children,
  className,
  backgroundSrc
}: {
  children: React.ReactNode
  className?: string
  backgroundSrc?: string
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[20px] border border-white/12 bg-white/[0.06] p-[1px] shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-3xl",
        className
      )}
    >
      {backgroundSrc ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-75"
          style={{
            backgroundImage: `url(${backgroundSrc})`,
            backgroundPosition: "center 38%"
          }}
        />
      ) : null}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.2),transparent_34%),radial-gradient(circle_at_85%_0%,rgba(56,189,248,0.18),transparent_26%),radial-gradient(circle_at_50%_120%,rgba(168,85,247,0.12),transparent_32%)] opacity-90" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent_28%,rgba(255,255,255,0.03)_48%,transparent_68%,rgba(255,255,255,0.08))] opacity-70 mix-blend-screen" />
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute -left-24 top-6 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-44 w-44 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="relative rounded-[19px] border border-white/10 bg-[rgba(10,10,10,0.45)] backdrop-blur-[18px]">
        {children}
      </div>
    </div>
  )
}

export default function AIInfluencerPage() {
  const router = useRouter()
  const [historyImages, setHistoryImages] = React.useState<ImageHistoryItem[]>([])
  const [selectedCharacter, setSelectedCharacter] = React.useState<ImageHistoryItem | null>(null)
  
  // Creation States
  const [characterName, setCharacterName] = React.useState("")
  const [uploadedFiles, setUploadedFiles] = React.useState<Array<{ file: File; url: string }>>([])
  const [selectedTraits, setSelectedTraits] = React.useState<{ [key: string]: string }>({})
  
  // Custom input states per category
  const [customTraits, setCustomTraits] = React.useState<{ [key: string]: string }>({})
  const [customInputs, setCustomInputs] = React.useState<{ [key: string]: string }>({})
  const [editingCustomTraitKey, setEditingCustomTraitKey] = React.useState<string | null>(null)
  
  // Global page UI states
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false)
  const [isHelpOpen, setIsHelpOpen] = React.useState(false)
  const [isNameDialogOpen, setIsNameDialogOpen] = React.useState(false)
  const [isBuilderSheetOpen, setIsBuilderSheetOpen] = React.useState(false)
  
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  
  // Fetch history
  const fetchHistory = React.useCallback(async () => {
    setIsHistoryLoading(true)
    try {
      const [generationsResponse, assetsResponse] = await Promise.all([
        fetch(`/api/generations?tool=ai_influencer&limit=30`),
        fetch(`/api/assets?category=character&limit=100`),
      ])
      if (!generationsResponse.ok) throw new Error("Failed to fetch characters")
      if (!assetsResponse.ok) throw new Error("Failed to fetch character assets")
      const [generationData, assetData] = await Promise.all([
        generationsResponse.json(),
        assetsResponse.json(),
      ])

      const characterAssets = Array.isArray(assetData.assets) ? (assetData.assets as Array<{ title?: string; sourceGenerationId?: string | null; url?: string }>) : []
      const assetTitleByGenerationId = new Map(
        characterAssets
          .filter((asset) => typeof asset.sourceGenerationId === "string" && asset.sourceGenerationId.trim().length > 0)
          .map((asset) => [asset.sourceGenerationId as string, typeof asset.title === "string" ? asset.title : null] as const)
          .filter(([, title]) => typeof title === "string" && title.trim().length > 0)
      )
      const assetTitleByUrl = new Map(
        characterAssets
          .filter((asset) => typeof asset.url === "string" && asset.url.trim().length > 0)
          .map((asset) => [asset.url as string, typeof asset.title === "string" ? asset.title : null] as const)
          .filter(([, title]) => typeof title === "string" && title.trim().length > 0)
      )

      const parsed: ImageHistoryItem[] = (generationData.generations || [])
        .map((gen: any) => ({
          id: gen.id,
          url: gen.url,
          model: gen.model,
          prompt: gen.prompt,
          displayName:
            assetTitleByGenerationId.get(gen.id) ||
            assetTitleByUrl.get(gen.url) ||
            null,
          tool: gen.tool,
          aspectRatio: gen.aspect_ratio,
          type: gen.type,
          createdAt: gen.created_at,
          reference_image_urls: gen.reference_image_urls || [],
        }))
        .filter((item: ImageHistoryItem) => typeof item.url === "string" && item.url.length > 0)
      
      setHistoryImages(parsed)
      return parsed
    } catch (err) {
      console.error(err)
      return []
    } finally {
      setIsHistoryLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchHistory()
    
    // Check if user has seen informational guide
    const guideSeen = localStorage.getItem("unican-influencer-guide-seen")
    if (!guideSeen) {
      localStorage.setItem("unican-influencer-guide-seen", "true")
      setIsHelpOpen(true)
    }
  }, [fetchHistory])

  // Reset current builder selections
  const handleReset = React.useCallback(() => {
    setSelectedCharacter(null)
    setCharacterName("")
    setUploadedFiles([])
    setSelectedTraits({})
    setCustomTraits({})
    setCustomInputs({})
    setEditingCustomTraitKey(null)
  }, [])

  const handleDownloadSelectedCharacter = React.useCallback(async () => {
    if (!selectedCharacter?.url) return

    try {
      await downloadMediaFile({
        url: selectedCharacter.url,
        kind: "image",
        filenamePrefix: getCharacterDownloadName(selectedCharacter),
      })
      toast.success("Download started")
    } catch (error) {
      console.error(error)
      toast.error("Could not download the character image")
    }
  }, [selectedCharacter])

  const saveCharacterAsset = React.useCallback(
    async ({
      title,
      url,
      description,
      tags,
      model,
      sourceGenerationId,
      sourceMode,
    }: {
      title: string
      url: string
      description: string | null
      tags: string[]
      model: string | null
      sourceGenerationId: string | null
      sourceMode: "upload" | "generated"
    }) => {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          url,
          assetType: "image",
          category: "character",
          visibility: "private",
          tags,
          description,
          sourceNodeType: "ai_influencer",
          sourceGenerationId,
          metadata: {
            source: "ai-influencer",
            mode: sourceMode,
            model,
            description,
            tags,
          },
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
        throw new Error(payload.message || payload.error || "Failed to save character asset")
      }
    },
    []
  )

  const openCharacterInStudio = React.useCallback(
    (target: "image" | "video") => {
      if (!selectedCharacter?.url) return

      const referenceImageUrl = new URL(selectedCharacter.url, window.location.origin).toString()
      const params = new URLSearchParams({
        referenceImageUrl,
      })

      router.push(`/${target}?${params.toString()}`)
    },
    [router, selectedCharacter?.url]
  )

  // Detect mode based on uploaded reference files
  const getDetectedMode = () => {
    if (uploadedFiles.length === 1) return "Direct Save (Mode 1)"
    if (uploadedFiles.length >= 2) return "Merge References (Mode 2)"
    return "Build from Traits (Mode 3)"
  }

  // Shuffle/randomize options
  const handleShuffle = () => {
    const newTraits: { [key: string]: string } = {}
    Object.entries(TRAITS).forEach(([key, category]) => {
      const allOptions = [...category.options, ...(customTraits[key] ? [customTraits[key]] : [])]
      const randomIdx = Math.floor(Math.random() * allOptions.length)
      newTraits[key] = allOptions[randomIdx]
    })
    setSelectedTraits(newTraits)
    toast.success("Traits randomized!")
  }

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newFiles = files.slice(0, 3 - uploadedFiles.length).map(file => ({
      file,
      url: URL.createObjectURL(file)
    }))

    setUploadedFiles(prev => [...prev, ...newFiles].slice(0, 3))
  }

  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].url)
      updated.splice(index, 1)
      return updated
    })
  }

  // Custom traits addition
  const handleAddCustomTrait = (categoryKey: string) => {
    const val = (customInputs[categoryKey] || "").trim()
    if (!val) return

    setCustomTraits(prev => ({
      ...prev,
      [categoryKey]: val
    }))
    setSelectedTraits(prev => ({
      ...prev,
      [categoryKey]: val
    }))
    setCustomInputs(prev => ({ ...prev, [categoryKey]: "" }))
    setEditingCustomTraitKey(null)
  }

  const openCustomTraitEditor = (categoryKey: string) => {
    setCustomInputs(prev => ({ ...prev, [categoryKey]: customTraits[categoryKey] || "" }))
    setEditingCustomTraitKey(categoryKey)
  }

  const editingCustomTraitLabel = editingCustomTraitKey
    ? TRAITS[editingCustomTraitKey as keyof typeof TRAITS]?.label || "option"
    : "option"

  // Trigger naming modal or create
  const handleCreateTrigger = () => {
    // Open name prompt dialog
    setIsNameDialogOpen(true)
  }

  // Main Action: Create/Save Character
  const handleCreate = async () => {
    const name = characterName.trim()
    if (!name) {
      toast.error("Please enter a name for your character")
      return
    }

    setIsNameDialogOpen(false)
    setIsGenerating(true)
    try {
      const mode = getDetectedMode()

      if (uploadedFiles.length === 1) {
        // Mode 1: Upload and save directly
        toast.loading("Saving your character upload...", { id: "influencer-toast" })
        const uploadResult = await uploadFileToSupabase(uploadedFiles[0].file, "ai-influencer")
        if (!uploadResult) throw new Error("Failed to upload character photo")

        const response = await fetch("/api/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: name,
            supabase_storage_path: uploadResult.storagePath,
            model: "upload",
            tool: "ai_influencer",
            type: "image"
          })
        })

        if (!response.ok) {
          const errData = await response.json()
          throw new Error(errData.error || "Failed to save character in database")
        }

        const payload = (await response.json()) as {
          generation?: { id?: string; url?: string }
        }
        const savedGeneration = payload.generation ?? {}
        const savedUrl = savedGeneration.url || uploadResult.url
        const createdCharacter: ImageHistoryItem = {
          id: typeof savedGeneration.id === "string" ? savedGeneration.id : `upload-${Date.now()}`,
          url: savedUrl,
          model: "upload",
          displayName: name,
          prompt: name,
          tool: "ai_influencer",
          aspectRatio: null,
          type: "image",
          createdAt: new Date().toISOString(),
          reference_image_urls: [],
        }
        try {
          await saveCharacterAsset({
            title: name,
            url: savedUrl,
            description: `Uploaded character reference for ${name}`,
            tags: buildCharacterAssetTags(selectedTraits, "upload", true),
            model: "upload",
            sourceGenerationId: typeof savedGeneration.id === "string" ? savedGeneration.id : null,
            sourceMode: "upload",
          })
        } catch (assetError) {
          console.error("[ai-influencer] saveCharacterAsset(upload)", assetError)
        }

        toast.success("Character saved successfully!", { id: "influencer-toast" })
        handleReset()
        setSelectedCharacter(createdCharacter)
        const refreshedHistory = await fetchHistory()
        const matchingCharacter = refreshedHistory.find(
          (item) => item.id === createdCharacter.id || item.url === createdCharacter.url
        )
        if (matchingCharacter) {
          setSelectedCharacter({
            ...matchingCharacter,
            displayName: createdCharacter.displayName ?? matchingCharacter.displayName,
            trackedPills: createdCharacter.trackedPills?.length
              ? createdCharacter.trackedPills
              : matchingCharacter.trackedPills,
          })
        }
      } else {
        // Mode 2 & 3: Run model generation with GPT Image 2
        toast.loading("Generating your AI Influencer (this may take a few seconds)...", { id: "influencer-toast" })

        const prompt = buildCharacterGenerationPrompt(name, selectedTraits, uploadedFiles.length >= 2)

        const formData = new FormData()
        formData.append("model", "openai/gpt-image-2")
        formData.append("prompt", prompt)
        formData.append("enhancePrompt", "true")
        formData.append("tool", "ai_influencer")
        formData.append("aspect_ratio", "1:1")

        // Append files if they exist (Mode 2)
        uploadedFiles.forEach(item => {
          formData.append("referenceImages", item.file)
        })

        let acceptedGenerationId: string | null = null
        const result = await generateImageAndWait(
          formData,
          {
            onAccepted: ({ generationId }) => {
              acceptedGenerationId = generationId ?? null
            },
          }
        )
        const generatedUrl = "image" in result ? result.image.url : result.images[0]?.url
        if (!generatedUrl) throw new Error("Failed to create character image")
        const createdCharacter: ImageHistoryItem = {
          id: acceptedGenerationId ?? `generated-${Date.now()}`,
          url: generatedUrl,
          model: "openai/gpt-image-2",
          displayName: name,
          trackedPills: Object.values(selectedTraits)
            .map((value) => value.trim())
            .filter(Boolean),
          prompt,
          tool: "ai_influencer",
          aspectRatio: "1:1",
          type: "image",
          createdAt: new Date().toISOString(),
          reference_image_urls: uploadedFiles.map((item) => item.url),
        }
        try {
          await saveCharacterAsset({
            title: name,
            url: generatedUrl,
            description: prompt,
            tags: buildCharacterAssetTags(selectedTraits, "openai/gpt-image-2", false),
            model: "openai/gpt-image-2",
            sourceGenerationId: acceptedGenerationId,
            sourceMode: "generated",
          })
        } catch (assetError) {
          console.error("[ai-influencer] saveCharacterAsset(generated)", assetError)
        }
        toast.success("AI Influencer created successfully!", { id: "influencer-toast" })
        handleReset()
        setSelectedCharacter(createdCharacter)
        const refreshedHistory = await fetchHistory()
        const matchingCharacter = refreshedHistory.find(
          (item) => item.id === createdCharacter.id || item.url === createdCharacter.url
        )
        if (matchingCharacter) {
          setSelectedCharacter({
            ...matchingCharacter,
            displayName: createdCharacter.displayName ?? matchingCharacter.displayName,
            trackedPills: createdCharacter.trackedPills?.length
              ? createdCharacter.trackedPills
              : matchingCharacter.trackedPills,
          })
        }
      }
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : "Failed to create character"
      if (isInsufficientCreditsError(err) || isInsufficientCreditsMessage(msg)) {
        showCreditsUpsellToast({
          message: msg,
          description: "Upgrade your plan to get more credits for character generation",
          toastId: "influencer-credits-upsell"
        })
      } else {
        toast.error(msg, { id: "influencer-toast" })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  // Delete Character
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Are you sure you want to delete this character?")) return

    try {
      const response = await fetch(`/api/generations/${id}`, {
        method: "DELETE"
      })
      if (!response.ok) throw new Error("Failed to delete character")
      
      toast.success("Character deleted")
      if (selectedCharacter?.id === id) {
        setSelectedCharacter(null)
      }
      void fetchHistory()
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete character")
    }
  }

  // Close Informational Dialog & Save Preference
  const handleCloseHelp = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem("unican-influencer-guide-seen", "true")
    }
    setIsHelpOpen(false)
  }

  const builderPanel = (mobile = false) => (
    <div className={cn("flex h-full min-h-0 flex-col", mobile && "pt-14")}>
      <div className={cn("p-4 border-b border-border/40 flex items-center justify-between", mobile && "pr-14")}>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-display">Builder</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground h-7 px-2.5"
        >
          Reset
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 px-4 pb-4">
        <Accordion type="multiple" defaultValue={Object.keys(TRAITS)} className="space-y-2.5 pb-8 pr-1">
          
          {Object.entries(TRAITS).map(([key, category]) => {
            const CategoryIcon = category.icon
            const selectedVal = selectedTraits[key]
            const traitArtwork = TRAIT_ARTWORK[key as keyof typeof TRAIT_ARTWORK]
            const customTraitValue = customTraits[key] || ""
            
            return (
              <AccordionItem 
                key={key} 
                value={key}
                className="border-none rounded-lg overflow-hidden bg-secondary/5 mb-2.5"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/10 transition-colors [&[data-state=open]>div>svg]:rotate-180">
                  <div className="flex items-center gap-2">
                    <CategoryIcon className="size-3.5 text-muted-foreground" />
                    <span className="text-xs font-bold text-foreground font-display tracking-wider uppercase">{category.label}</span>
                    {selectedVal && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold px-2 py-0.5 ml-2.5">
                        {selectedVal}
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-1 border-t border-border/10">
                  <div className={cn("grid gap-2 mt-2", category.columns)}>
                    
                    {/* Render standard options */}
                    {category.options.map(option => {
                      const isSelected = selectedVal === option
                      
                      // Render visually rich card builders
                      return (
                        <button
                          key={option}
                          onClick={() => setSelectedTraits(prev => ({ ...prev, [key]: option }))}
                          className={cn(
                            "flex flex-col items-stretch justify-center rounded-lg border border-border/40 bg-secondary/15 hover:bg-secondary/30 transition-all text-center aspect-square relative overflow-hidden group",
                            isSelected && "border-primary ring-1 ring-primary/20 opacity-90"
                          )}
                        >
                          {traitArtwork?.options[option as keyof typeof traitArtwork.options] ? (
                            <>
                              <Image
                                src={traitArtwork.options[option as keyof typeof traitArtwork.options]}
                                alt=""
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                sizes="(max-width: 1024px) 33vw, 180px"
                              />
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_38%),linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.62))]" />
                            </>
                          ) : null}

                          {/* Visual iris preview for Eye Colour */}
                          {key === "eyeColour" && EYE_COLORS[option] && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center px-3">
                              <div 
                                style={{ background: EYE_COLORS[option] }}
                                className="size-8 rounded-full border border-white/20 shadow-inner flex items-center justify-center group-hover:scale-110 transition-transform"
                              >
                                <div className="size-1.5 rounded-full bg-black" />
                              </div>
                            </div>
                          )}

                          {/* Visual color swatch for Skin Tone */}
                          {key === "skinTone" && SKIN_TONES[option] && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center px-3">
                              <div 
                                style={{ backgroundColor: SKIN_TONES[option] }}
                                className="h-8 w-8 rounded-full border border-white/10 shadow-sm group-hover:scale-105 transition-transform"
                              />
                            </div>
                          )}

                          {/* Visual color swatch for Hair Colour */}
                          {key === "hairColour" && HAIR_COLORS[option] && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center px-3">
                              <div 
                                style={{ backgroundColor: HAIR_COLORS[option] }}
                                className="size-8 rounded-full border border-white/15 shadow-sm group-hover:scale-110 transition-transform"
                              />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2 pb-2 pt-8">
                            <span className="block text-[10px] font-bold font-display tracking-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                              {option}
                            </span>
                          </div>
                        </button>
                      )
                    })}

                    {/* Custom Trait Card */}
                    <button
                      onClick={() => openCustomTraitEditor(key)}
                      className={cn(
                        "flex flex-col items-stretch justify-center rounded-lg border border-dashed border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all text-center aspect-square relative overflow-hidden group",
                        selectedVal === customTraitValue && "border-primary ring-1 ring-primary/20 opacity-90"
                      )}
                    >
                      <Image
                        src={CUSTOM_TRAIT_IMAGE}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 33vw, 180px"
                      />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_38%),linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.62))]" />
                      <div className="absolute inset-0 z-10 flex items-center justify-center px-3">
                        <Plus className="size-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2 pb-2 pt-8">
                        <span className="block text-[10px] font-bold font-display tracking-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                          {customTraitValue || `+ Custom`}
                        </span>
                      </div>
                    </button>

                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}

        </Accordion>
      </ScrollArea>
    </div>
  )

  return (
    <div className="h-[100dvh] min-h-0 overflow-hidden bg-black text-foreground flex flex-col pt-[52px]">
      <div className="flex-1 min-h-0 w-full max-w-full flex flex-col lg:flex-row overflow-hidden min-w-0">
        
        {/* Left Column: Characters History (Narrow, Clean sidebar look) */}
        <div className="w-full lg:w-[180px] shrink-0 min-w-0 border-b lg:border-b-0 lg:border-r border-border/40 bg-muted/5 flex flex-col h-1/4 lg:h-full min-h-0">
          <div className="p-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-display">Characters</h2>
            <button
              onClick={() => setIsHelpOpen(true)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Open help guide"
            >
              <Info className="size-3.5" />
            </button>
          </div>
          <ScrollArea className="flex-1 min-h-0 px-3 pb-3">
            <div className="flex gap-2.5 overflow-x-auto overflow-y-hidden pb-2 pr-1 touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-flow-row lg:grid-cols-1 lg:gap-2.5 lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0 lg:pr-0">
              
              {/* Reset/Create New Card */}
              <button
                onClick={handleReset}
                className={cn(
                  "flex shrink-0 flex-col items-center justify-center p-3 rounded-xl border border-dashed border-border/40 bg-secondary/15 hover:bg-secondary/30 hover:border-primary/50 transition-all aspect-square w-[96px] sm:w-[108px] lg:w-full",
                  !selectedCharacter && "border-primary/45 bg-primary/5 shadow-[0_0_12px_rgba(168,85,247,0.06)]"
                )}
              >
                <Plus className="size-4 text-primary mb-1" weight="bold" />
                <span className="text-[10px] font-bold tracking-tight">Create new</span>
              </button>

              {/* Previously Generated Characters */}
              {historyImages.map(item => {
                const isActive = selectedCharacter?.id === item.id
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedCharacter(item)
                      setCharacterName(getCharacterDisplayName(item))
                    }}
                    className={cn(
                      "group relative flex shrink-0 flex-col justify-end p-2 rounded-xl border border-border/30 bg-secondary/10 hover:bg-secondary/20 cursor-pointer transition-all aspect-square w-[96px] sm:w-[108px] lg:w-full overflow-hidden",
                      isActive && "border-primary ring-1 ring-primary/30"
                    )}
                  >
                    <img
                      src={item.url}
                      alt={item.prompt || "Character"}
                      className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-102 transition-transform"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent h-1/2 p-2 pt-4 flex items-end" />
                    
                    {/* Delete button overlay */}
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-destructive rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      aria-label="Delete character"
                    >
                      <Trash className="size-2.5 text-white" />
                    </button>

                    <span className="relative z-10 truncate max-w-full text-[10px] font-black uppercase tracking-[-0.03em] text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">
                      {getCharacterDisplayName(item)}
                    </span>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Middle Column: Preview & Action Canvas (Spacious, Centered card) */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col justify-between items-center p-4 lg:px-8 lg:pt-0 lg:pb-8 bg-black relative overflow-hidden overflow-x-hidden h-2/4 lg:h-full">
          <div className="w-full max-w-lg flex-1 flex flex-col justify-start py-4 lg:py-0">
            
            {/* Main Preview Card with big round borders */}
            <Card className="w-full aspect-[4/5] sm:aspect-square lg:aspect-[4/5] bg-secondary/5 border-border/40 overflow-hidden relative shadow-2xl flex flex-col justify-center items-center p-0 group rounded-2xl">
              {selectedCharacter ? (
                // Selected/Active Character Mode
                <div className="absolute inset-0 w-full h-full">
                  <img
                    src={selectedCharacter.url}
                    alt={selectedCharacter.prompt || "AI Influencer"}
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.12)_44%,rgba(0,0,0,0.88)_100%)]" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void handleDownloadSelectedCharacter()}
                    className="absolute right-4 top-4 z-20 size-11 rounded-full border-white/10 bg-black/55 text-white shadow-lg backdrop-blur-md hover:bg-black/70"
                    aria-label="Download character image"
                  >
                    <DownloadSimple className="size-4" />
                  </Button>
                  <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-6">
                    <div className="flex min-w-0 flex-col gap-4">
                      <div className="min-w-0">
                        <h3 className="max-w-full truncate text-[30px] leading-[0.92] font-black uppercase tracking-[-0.05em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)] sm:text-[38px]">
                          {getCharacterDisplayName(selectedCharacter)}
                        </h3>
                        {selectedCharacter.trackedPills?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {selectedCharacter.trackedPills.map((tag) => (
                              <Badge
                                key={tag}
                                className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          onClick={() => openCharacterInStudio("image")}
                          className="h-11 rounded-full border border-white/10 bg-white/10 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg backdrop-blur-md hover:bg-white/15"
                        >
                          <FileImage className="mr-2 size-4" />
                          Use in Image
                        </Button>
                        <Button
                          type="button"
                          onClick={() => openCharacterInStudio("video")}
                          className="h-11 rounded-full border border-white/10 bg-white/10 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg backdrop-blur-md hover:bg-white/15"
                        >
                          <Sparkle className="mr-2 size-4" />
                          Use in Video
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : isGenerating ? (
                <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.09),transparent_45%),linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.78))] px-6">
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.08)_50%,transparent_100%)] opacity-70 animate-pulse" />
                  <div className="relative flex w-full max-w-[320px] justify-center">
                    <GenerationLoadingSlots
                      count={6}
                      maxVisible={6}
                      className="flex-wrap justify-center gap-2"
                      tileClassName="h-12 w-12 rounded-2xl border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
                    />
                  </div>
                </div>
              ) : (
                // Creation / Mode Input Mode
                <div className="w-full h-full flex flex-col justify-between items-stretch">
                  
                  {/* File Upload Drop Area */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 w-full flex flex-col justify-center items-center cursor-pointer px-4 py-6 transition-colors hover:bg-primary/5"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      multiple
                      accept="image/*"
                      className="hidden"
                    />

                    {uploadedFiles.length === 0 ? (
                      <div className="text-center flex flex-col items-center max-w-sm">
                        <h4 className="text-sm font-bold text-foreground mb-1 font-display uppercase tracking-wider">Add reference photos</h4>
                        <p className="text-xs text-muted-foreground leading-normal mt-1 max-w-[280px] space-y-1">
                          <span className="block">Save characters instantly with 1 photo.</span>
                          <span className="block">Blend 2-3 photos into one new face.</span>
                          <span className="block">Or build a new character with the builder.</span>
                        </p>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="mt-6 gap-1.5 h-8 font-semibold shadow-sm rounded-full bg-secondary/50 hover:bg-secondary border border-border/30 text-xs px-4"
                        >
                          <UploadSimple className="size-3.5" />
                          Upload photos
                        </Button>
                      </div>
                    ) : (
                      // Multi-file Thumbnails Preview
                      <div className="w-full grid grid-cols-3 gap-3">
                        {uploadedFiles.map((item, idx) => (
                          <div key={idx} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-border/40 bg-black group/thumb">
                            <img
                              src={item.url}
                              alt="preview"
                              className="w-full h-full object-cover"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeUploadedFile(idx)
                              }}
                              className="absolute top-1 right-1 p-1 bg-black/80 hover:bg-destructive rounded-full transition-colors"
                              aria-label="Remove photo"
                            >
                              <X className="size-3 text-white" />
                            </button>
                          </div>
                        ))}
                        {uploadedFiles.length < 3 && (
                          <div className="border border-dashed border-border/40 hover:border-primary/40 flex flex-col justify-center items-center rounded-lg aspect-[3/4] transition-colors">
                            <Plus className="size-5 text-muted-foreground" />
                            <span className="text-[10px] font-medium text-muted-foreground mt-1">Add</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dynamic Traits Tags container attached to bottom of preview */}
                  {Object.keys(selectedTraits).length > 0 && (
                    <div className="w-full px-4 pb-4 pt-3 border-t border-border/20 bg-black/10">
                      <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto pr-1">
                        <AnimatePresence initial={false} mode="popLayout">
                          {Object.entries(selectedTraits).map(([key, val]) => (
                            <motion.div
                              key={`${key}:${val}`}
                              layout
                              initial={{ opacity: 0, y: 8, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.96 }}
                              transition={{ duration: 0.18, ease: "easeOut" }}
                            >
                              <Badge 
                                variant="secondary"
                                className="bg-secondary/40 hover:bg-secondary border-border/40 text-[9px] pl-2 pr-1.5 py-0.5 flex items-center gap-1 font-medium"
                              >
                                <span className="text-muted-foreground">{TRAITS[key as keyof typeof TRAITS]?.label || key}:</span>
                                <span className="text-foreground">{val}</span>
                                <button 
                                  onClick={() => {
                                    setSelectedTraits(prev => {
                                      const next = { ...prev }
                                      delete next[key]
                                      return next
                                    })
                                  }}
                                  className="hover:text-destructive transition-colors ml-0.5 p-0.5 rounded-full"
                                >
                                  <X className="size-2.5" />
                                </button>
                              </Badge>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </Card>

            {/* Character Controls - Centered capsules */}
            {!selectedCharacter && (
              <div className="mt-6 flex flex-col gap-3 w-full items-center">
                <div className="flex items-center gap-3 w-full max-w-md">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShuffle}
                    disabled={isGenerating}
                    className="size-11 shrink-0 rounded-full border-border/40 hover:bg-secondary/20 transition-colors shadow-sm bg-secondary/5"
                    title="Randomize Traits"
                  >
                    <Shuffle className="size-4 text-foreground" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsBuilderSheetOpen(true)}
                    className="size-11 shrink-0 rounded-full border-border/40 hover:bg-secondary/20 transition-colors shadow-sm bg-secondary/5 lg:hidden"
                    title="Open Builder"
                  >
                    <User className="size-4 text-foreground" />
                  </Button>
                  <Button
                    onClick={handleCreateTrigger}
                    disabled={isGenerating}
                    className="flex-1 h-11 font-bold text-xs uppercase tracking-wider bg-transparent border border-border/60 rounded-full text-foreground hover:bg-secondary/20 hover:border-foreground transition-all"
                  >
                    {isGenerating ? (
                      <span className="flex items-center justify-center gap-2">
                        <ArrowsClockwise className="size-3.5 animate-spin" />
                        Generating...
                      </span>
                    ) : (
                      "Create character"
                    )}
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Visual Prompt Builder (Wider layout with custom grids) */}
        <div className="hidden lg:flex w-full lg:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-border/40 bg-muted/5 flex-col h-1/4 lg:h-full min-h-0 overflow-hidden">
          <div className="p-4 border-b border-border/40 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-display">Builder</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleReset}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground h-7 px-2.5"
            >
              Reset
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <Accordion type="multiple" defaultValue={Object.keys(TRAITS)} className="space-y-2.5 pb-8">
              
              {Object.entries(TRAITS).map(([key, category]) => {
                const CategoryIcon = category.icon
                const selectedVal = selectedTraits[key]
                const traitArtwork = TRAIT_ARTWORK[key as keyof typeof TRAIT_ARTWORK]
                const customTraitValue = customTraits[key] || ""
                
                return (
                  <AccordionItem 
                    key={key} 
                    value={key}
                    className="border-none rounded-lg overflow-hidden bg-secondary/5 mb-2.5"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-secondary/10 transition-colors [&[data-state=open]>div>svg]:rotate-180">
                      <div className="flex items-center gap-2">
                        <CategoryIcon className="size-3.5 text-muted-foreground" />
                        <span className="text-xs font-bold text-foreground font-display tracking-wider uppercase">{category.label}</span>
                        {selectedVal && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold px-2 py-0.5 ml-2.5">
                            {selectedVal}
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-1 border-t border-border/10">
                      <div className={cn("grid gap-2 mt-2", category.columns)}>
                        
                        {/* Render standard options */}
                        {category.options.map(option => {
                          const isSelected = selectedVal === option
                          
                          // Render visually rich card builders
                          return (
                            <button
                              key={option}
                              onClick={() => setSelectedTraits(prev => ({ ...prev, [key]: option }))}
                              className={cn(
                                "flex flex-col items-stretch justify-center rounded-lg border border-border/40 bg-secondary/15 hover:bg-secondary/30 transition-all text-center aspect-square relative overflow-hidden group",
                                isSelected && "border-primary ring-1 ring-primary/20 opacity-90"
                              )}
                            >
                              {traitArtwork?.options[option as keyof typeof traitArtwork.options] ? (
                                <>
                                  <Image
                                    src={traitArtwork.options[option as keyof typeof traitArtwork.options]}
                                    alt=""
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    sizes="(max-width: 1024px) 33vw, 180px"
                                  />
                                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_38%),linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.62))]" />
                                </>
                              ) : null}

                              {/* Visual iris preview for Eye Colour */}
                              {key === "eyeColour" && EYE_COLORS[option] && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center px-3">
                                  <div 
                                    style={{ background: EYE_COLORS[option] }}
                                    className="size-8 rounded-full border border-white/20 shadow-inner flex items-center justify-center group-hover:scale-110 transition-transform"
                                  >
                                    <div className="size-1.5 rounded-full bg-black" />
                                  </div>
                                </div>
                              )}

                              {/* Visual color swatch for Skin Tone */}
                              {key === "skinTone" && SKIN_TONES[option] && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center px-3">
                                  <div 
                                    style={{ backgroundColor: SKIN_TONES[option] }}
                                    className="h-8 w-8 rounded-full border border-white/10 shadow-sm group-hover:scale-105 transition-transform"
                                  />
                                </div>
                              )}

                              {/* Visual color swatch for Hair Colour */}
                              {key === "hairColour" && HAIR_COLORS[option] && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center px-3">
                                  <div 
                                    style={{ backgroundColor: HAIR_COLORS[option] }}
                                    className="size-8 rounded-full border border-white/15 shadow-sm group-hover:scale-110 transition-transform"
                                  />
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2 pb-2 pt-8">
                                <span className="block text-[10px] font-bold font-display tracking-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                                  {option}
                                </span>
                              </div>
                            </button>
                          )
                        })}

                        {/* Custom Trait Card */}
                        <button
                          onClick={() => openCustomTraitEditor(key)}
                          className={cn(
                            "flex flex-col items-stretch justify-center rounded-lg border border-dashed border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all text-center aspect-square relative overflow-hidden group",
                            selectedVal === customTraitValue && "border-primary ring-1 ring-primary/20 opacity-90"
                          )}
                        >
                          <Image
                            src={CUSTOM_TRAIT_IMAGE}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 33vw, 180px"
                          />
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_38%),linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.62))]" />
                          <div className="absolute inset-0 z-10 flex items-center justify-center px-3">
                            <Plus className="size-5 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2 pb-2 pt-8">
                            <span className="block text-[10px] font-bold font-display tracking-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                              {customTraitValue || `+ Custom`}
                            </span>
                          </div>
                        </button>

                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}

            </Accordion>
          </div>
        </div>

        </div>

        <Sheet open={isBuilderSheetOpen} onOpenChange={setIsBuilderSheetOpen}>
          <SheetContent side="right" className="w-[92vw] max-w-[420px] p-0 overflow-hidden bg-muted/5">
            <SheetHeader className="sr-only">
              <SheetTitle>Builder</SheetTitle>
            </SheetHeader>
            {builderPanel(true)}
          </SheetContent>
        </Sheet>

      <Dialog
        open={editingCustomTraitKey !== null}
        onOpenChange={(open) => {
          if (!open) setEditingCustomTraitKey(null)
        }}
      >
        <DialogContent className="max-w-sm bg-popover border-border/60 p-6 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-center text-sm font-bold font-display uppercase tracking-wider">
              {`Enter custom ${editingCustomTraitLabel}`}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground mt-1">
              Give this custom {editingCustomTraitLabel.toLowerCase()} a short label.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder={`Enter custom ${editingCustomTraitLabel}`}
              value={editingCustomTraitKey ? customInputs[editingCustomTraitKey] || "" : ""}
              onChange={(e) => {
                if (!editingCustomTraitKey) return
                setCustomInputs(prev => ({ ...prev, [editingCustomTraitKey]: e.target.value }))
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editingCustomTraitKey) {
                  handleAddCustomTrait(editingCustomTraitKey)
                }
              }}
              className="bg-secondary/20 border-border/40"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingCustomTraitKey(null)}
              className="flex-1 rounded-full text-xs font-semibold uppercase tracking-wider h-10"
            >
              Cancel
            </Button>
            <Button
              onClick={() => editingCustomTraitKey && handleAddCustomTrait(editingCustomTraitKey)}
              disabled={!editingCustomTraitKey || !(customInputs[editingCustomTraitKey] || "").trim()}
              className="flex-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground h-10"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Name Input Dialog Modal */}
      <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
        <DialogContent className="max-w-sm bg-popover border-border/60 p-6 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-center text-sm font-bold font-display uppercase tracking-wider">
              Name your Character
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground mt-1">
              Give your character a unique name to identify them in your library.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="e.g. lana, Koko, model_v1"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value.replace(/[^a-zA-Z0-9_\-\s]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && characterName.trim()) {
                  void handleCreate()
                }
              }}
              className="bg-secondary/20 border-border/40"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsNameDialogOpen(false)}
              className="flex-1 rounded-full text-xs font-semibold uppercase tracking-wider h-10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!characterName.trim() || isGenerating}
              className="flex-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground h-10"
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Onboarding Guide Modal remade using installed premium LiquidGlass component wrapper */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="!bg-transparent !p-0 !border-none !ring-0 !shadow-none max-w-md w-full overflow-visible">
          <LiquidGlassCard
            className="w-full"
            backgroundSrc="/ai_influencer/learn_influencer_faceless.jpg"
          >
            <div className="p-7 flex flex-col bg-black/10">
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-bold font-display uppercase tracking-wider text-white">
                  AI Influencer Builder
                </DialogTitle>
                <DialogDescription className="text-center text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto leading-normal">
                  UniCan enables you to create and save consistent AI characters and influencers in three modes.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-5">
                <div className="flex gap-3">
                  <div className="size-6 rounded-full bg-white/10 text-primary flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5">1</div>
                  <div>
                    <h4 className="text-xs font-bold text-white font-display uppercase tracking-wider">Direct Save Mode</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                      Upload exactly one photo of a character you already have, name them, and save them directly to your library.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="size-6 rounded-full bg-white/10 text-primary flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5">2</div>
                  <div>
                    <h4 className="text-xs font-bold text-white font-display uppercase tracking-wider">Merge References Mode</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                      Upload 2 or 3 closeups of different faces. We will blend and merge their facial structures into one consistent face.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="size-6 rounded-full bg-white/10 text-primary flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5">3</div>
                  <div>
                    <h4 className="text-xs font-bold text-white font-display uppercase tracking-wider">Build from Traits Mode</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                      No reference photos? Select a combination of gender, race, eye color, hair, and style on the right. We will build a new character prompt.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <Button 
                  onClick={() => handleCloseHelp(true)}
                  className="w-full font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-11 text-xs uppercase tracking-wider rounded-full shadow-lg shadow-primary/20"
                >
                  Get Started
                </Button>
                <DialogClose asChild>
                  <Button variant="ghost" className="w-full text-xs text-muted-foreground h-9 font-semibold hover:text-white uppercase tracking-wider rounded-full hover:bg-white/5">
                    Close Guide
                  </Button>
                </DialogClose>
              </div>
            </div>
          </LiquidGlassCard>
        </DialogContent>
      </Dialog>

    </div>
  )
}
