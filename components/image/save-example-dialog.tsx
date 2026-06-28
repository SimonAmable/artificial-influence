"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { Sparkle, Plus, X, Trash, FolderOpen } from "@phosphor-icons/react"

import { useModels } from "@/hooks/use-models"
import { cn } from "@/lib/utils"
import type { Model } from "@/lib/types/models"
import type { DraftTemplateInput } from "@/lib/templates/input-utils"
import {
  assignInputIds,
  createDefaultInput,
  labelToFieldId,
  placeholderToken,
} from "@/lib/templates/input-utils"
import type { TemplatePromptAttachment } from "@/lib/templates/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ImageEnhanceSwitch } from "@/components/tools/influencer/image-enhance-switch"

type SaveExampleVisibility = "private" | "public"

export type SaveExampleSnapshot = {
  prompt: string
  referenceImageUrls: string[]
  coverUrl: string
  selectedModel: string
  selectedAspectRatio: string
  selectedNumImages: number
  selectedModelParameters: Record<string, unknown>
  enhancePrompt: boolean
  sourceGenerationId?: string | null
}

interface SaveExampleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshot: SaveExampleSnapshot | null
  onSaved?: () => void | Promise<void>
}

type PromptAttachmentDraft = TemplatePromptAttachment & {
  id: string
}

type DraftInputRow = DraftTemplateInput & {
  id: string
  sourceAttachment?: PromptAttachmentDraft
}

type SelectionState = {
  start: number
  end: number
  text: string
  rect: DOMRect
}

const ASPECT_RATIO_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "9:16", label: "Vertical" },
  { value: "1:1", label: "Square" },
  { value: "16:9", label: "Wide" },
]

const NUM_IMAGES_OPTIONS = [1, 2, 3, 4]

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `example-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function buildExampleTitle(prompt: string) {
  const stripped = prompt
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!stripped) {
    return "New example"
  }

  const words = stripped.split(" ").slice(0, 8).join(" ")
  return words.length > 80 ? `${words.slice(0, 77)}...` : words
}

function formatPromptSelectionLabel(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (!cleaned) return "Variable"
  return cleaned.length > 48 ? `${cleaned.slice(0, 45)}...` : cleaned
}

function replaceRange(text: string, start: number, end: number, replacement: string) {
  return `${text.slice(0, start)}${replacement}${text.slice(end)}`
}

function getSelectionRangeWithin(root: HTMLElement) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null
  }

  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) {
    return null
  }

  const preRange = range.cloneRange()
  preRange.selectNodeContents(root)
  preRange.setEnd(range.startContainer, range.startOffset)

  const start = preRange.toString().length
  const end = start + range.toString().length
  const text = selection.toString()
  if (!text.trim()) return null

  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    return null
  }

  return { start, end, text, rect }
}

function findNearestTextNode(root: HTMLElement, targetOffset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current: Node | null = walker.nextNode()
  let remaining = Math.max(0, targetOffset)

  while (current) {
    const text = current.textContent ?? ""
    if (remaining <= text.length) {
      return { node: current, offset: remaining }
    }
    remaining -= text.length
    current = walker.nextNode()
  }

  return null
}

function setSelectionAtOffsets(root: HTMLElement, start: number, end: number) {
  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()
  const startPoint = findNearestTextNode(root, start)
  const endPoint = findNearestTextNode(root, end)

  if (startPoint && endPoint) {
    range.setStart(startPoint.node, startPoint.offset)
    range.setEnd(endPoint.node, endPoint.offset)
  } else {
    range.selectNodeContents(root)
    range.collapse(false)
  }

  selection.removeAllRanges()
  selection.addRange(range)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function SaveExampleDialog({
  open,
  onOpenChange,
  snapshot,
  onSaved,
}: SaveExampleDialogProps) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const { models: imageModels, isLoading: modelsLoading } = useModels("image")
  const promptEditorRef = React.useRef<HTMLDivElement>(null)
  const promptBoxRef = React.useRef<HTMLDivElement>(null)
  const selectionStateRef = React.useRef<SelectionState | null>(null)
  const [prompt, setPrompt] = React.useState("")
  const [attachments, setAttachments] = React.useState<PromptAttachmentDraft[]>([])
  const [draftInputs, setDraftInputs] = React.useState<DraftInputRow[]>([])
  const [visibility, setVisibility] = React.useState<SaveExampleVisibility>("private")
  const [selectedModel, setSelectedModel] = React.useState("")
  const [selectedAspectRatio, setSelectedAspectRatio] = React.useState("auto")
  const [selectedNumImages, setSelectedNumImages] = React.useState(1)
  const [selectedModelParameters, setSelectedModelParameters] = React.useState<Record<string, unknown>>({})
  const [enhancePrompt, setEnhancePrompt] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [selectionState, setSelectionState] = React.useState<SelectionState | null>(null)

  const selectedModelOptions = React.useMemo(() => {
    const models = imageModels as Model[]
    const hasSelected = models.some((model) => model.identifier === selectedModel)

    const options = [...models]
    if (selectedModel && !hasSelected) {
      options.unshift({
        id: `fallback-${selectedModel}`,
        identifier: selectedModel,
        name: selectedModel,
        description: "",
        type: "image",
        provider: "",
        is_active: true,
        model_cost: null,
        parameters: { parameters: [] },
        created_at: "",
        updated_at: "",
      } as unknown as Model)
    }

    return options
  }, [imageModels, selectedModel])

  React.useEffect(() => {
    if (!open || !snapshot) return

    const nextPrompt = snapshot.prompt ?? ""
    const nextAttachments = (snapshot.referenceImageUrls ?? [])
      .filter((url) => typeof url === "string" && url.trim().length > 0)
      .map((url) => ({
        id: createClientId(),
        url,
        title: null,
      }))

    setPrompt(nextPrompt)
    setAttachments(nextAttachments)
    setDraftInputs([])
    setVisibility("private")
    setSelectedModel(snapshot.selectedModel ?? "")
    setSelectedAspectRatio(snapshot.selectedAspectRatio || "auto")
    setSelectedNumImages(Math.max(1, Math.floor(snapshot.selectedNumImages || 1)))
    setSelectedModelParameters(snapshot.selectedModelParameters ?? {})
    setEnhancePrompt(snapshot.enhancePrompt === true)
    setSelectionState(null)
    selectionStateRef.current = null
    requestAnimationFrame(() => {
      if (promptEditorRef.current) {
        promptEditorRef.current.textContent = nextPrompt
      }
    })
  }, [open, snapshot])

  React.useEffect(() => {
    if (!open) {
      setSelectionState(null)
      selectionStateRef.current = null
    }
  }, [open])

  const updateSelectionFromDOM = React.useCallback(() => {
    const root = promptEditorRef.current
    if (!root) return

    const next = getSelectionRangeWithin(root)
    selectionStateRef.current = next
    setSelectionState(next)
  }, [])

  React.useEffect(() => {
    if (!open) return

    const handleSelectionChange = () => {
      updateSelectionFromDOM()
    }

    document.addEventListener("selectionchange", handleSelectionChange)
    return () => document.removeEventListener("selectionchange", handleSelectionChange)
  }, [open, updateSelectionFromDOM])

  const syncPromptEditor = React.useCallback((nextPrompt: string, caretOffset?: number) => {
    setPrompt(nextPrompt)
    requestAnimationFrame(() => {
      const editor = promptEditorRef.current
      if (!editor) return

      editor.textContent = nextPrompt
      if (typeof caretOffset === "number") {
        setSelectionAtOffsets(editor, caretOffset, caretOffset)
      }
    })
  }, [])

  const handlePromptInput = React.useCallback(() => {
    const editor = promptEditorRef.current
    if (!editor) return

    const nextPrompt = editor.textContent ?? ""
    setPrompt(nextPrompt)
    updateSelectionFromDOM()
  }, [updateSelectionFromDOM])

  const handlePromptPaste = React.useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData("text/plain")
    const editor = promptEditorRef.current
    if (!editor) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      const nextPrompt = `${prompt}${text}`
      syncPromptEditor(nextPrompt)
      return
    }

    const range = selection.getRangeAt(0)
    if (!editor.contains(range.commonAncestorContainer)) {
      const nextPrompt = `${prompt}${text}`
      syncPromptEditor(nextPrompt)
      return
    }

    const state = getSelectionRangeWithin(editor)
    if (!state) {
      const nextPrompt = `${prompt}${text}`
      syncPromptEditor(nextPrompt)
      return
    }

    const nextPrompt = replaceRange(prompt, state.start, state.end, text)
    syncPromptEditor(nextPrompt, state.start + text.length)
    setSelectionState(null)
    selectionStateRef.current = null
  }, [prompt, syncPromptEditor])

  const addTextInput = React.useCallback((label?: string, selection?: SelectionState | null) => {
    const cleanLabel = formatPromptSelectionLabel(label ?? "Variable")
    const usedIds = new Set(draftInputs.map((input) => input.id))
    const id = labelToFieldId(cleanLabel, usedIds)
    const input = {
      ...createDefaultInput("text", cleanLabel),
      id,
    } satisfies DraftInputRow

    setDraftInputs((current) => [...current, input])
    if (selection) {
      const token = placeholderToken({ kind: "text", id, label: cleanLabel, required: false })
      const nextPrompt = replaceRange(prompt, selection.start, selection.end, token)
      syncPromptEditor(nextPrompt, selection.start + token.length)
      setSelectionState(null)
      selectionStateRef.current = null
      return
    }

    const nextPrompt = prompt.trim().length > 0 ? `${prompt.trim()} {{${id}}}` : `{{${id}}}`
    syncPromptEditor(nextPrompt)
  }, [draftInputs, prompt, syncPromptEditor])

  const handleMakeVariable = React.useCallback(() => {
    if (!selectionStateRef.current) return
    addTextInput(selectionStateRef.current.text, selectionStateRef.current)
  }, [addTextInput])

  const handleAddManualTextInput = React.useCallback(() => {
    addTextInput()
  }, [addTextInput])

  // Fixed React 18 side effect updater bug
  const handleAttachmentAsInput = React.useCallback((attachmentId: string) => {
    const match = attachments.find((item) => item.id === attachmentId)
    if (!match) return

    const nextDraft = {
      ...createDefaultInput("image", match.title?.trim() || "Reference image"),
      id: createClientId(),
      sourceAttachment: match,
    } satisfies DraftInputRow

    setDraftInputs((inputs) => [...inputs, nextDraft])
    setAttachments((current) => current.filter((item) => item.id !== attachmentId))
  }, [attachments])

  // Fixed React 18 side effect updater bug
  const handleRemoveInput = React.useCallback((inputId: string) => {
    const target = draftInputs.find((item) => item.id === inputId)
    if (!target) return

    if (target.sourceAttachment) {
      setAttachments((existing) => [...existing, target.sourceAttachment!])
    }
    setDraftInputs((current) => current.filter((item) => item.id !== inputId))
  }, [draftInputs])

  const promptAttachmentPayload = React.useMemo(
    () =>
      attachments.map(({ url, title }) => ({
        url,
        title: title?.trim() ? title.trim() : null,
      })),
    [attachments],
  )

  const handleSave = React.useCallback(async () => {
    const finalPrompt = prompt.trim()
    if (!finalPrompt) {
      toast.error("Add a prompt before saving this example")
      return
    }

    setIsSaving(true)
    try {
      const finalInputs = assignInputIds(
        draftInputs.map((input) => {
          const { sourceAttachment: _sourceAttachment, ...rest } = input
          return rest
        }),
      )

      const draftToFinalId = new Map<string, string>()
      draftInputs.forEach((draft, idx) => {
        if (draft.id) {
          draftToFinalId.set(draft.id, finalInputs[idx].id)
        }
      })

      const referenceMediaOrder = (snapshot?.referenceImageUrls ?? [])
        .filter((url) => typeof url === "string" && url.trim().length > 0)
        .map((url) => {
          const matchingInputIndex = draftInputs.findIndex(
            (input) => input.sourceAttachment?.url === url
          )
          if (matchingInputIndex !== -1) {
            const draftInput = draftInputs[matchingInputIndex]
            const finalId = draftToFinalId.get(draftInput.id) || draftInput.id
            return { type: "input", id: finalId }
          }
          return { type: "attachment", url }
        })

      const title = buildExampleTitle(finalPrompt)
      const response = await fetch("/api/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface: "image",
          title,
          description: "",
          prompt: finalPrompt,
          prompt_attachments: promptAttachmentPayload,
          inputs: finalInputs,
          default_settings: {
            model: selectedModel || null,
            aspect_ratio: selectedAspectRatio || null,
            num_images: selectedNumImages,
            enhance_prompt: enhancePrompt,
            model_parameters: selectedModelParameters,
            reference_media_order: referenceMediaOrder,
          },
          source_generation_id: snapshot?.sourceGenerationId ?? null,
          cover_url: snapshot?.coverUrl ?? null,
          cover_kind: "image",
          visibility,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to save example",
        )
      }

      toast.success("Example saved")
      onOpenChange(false)
      await onSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save example")
    } finally {
      setIsSaving(false)
    }
  }, [
    draftInputs,
    enhancePrompt,
    onOpenChange,
    onSaved,
    prompt,
    promptAttachmentPayload,
    snapshot,
    selectedAspectRatio,
    selectedModel,
    selectedModelParameters,
    selectedNumImages,
    visibility,
  ])

  const selectedSelection = selectionState
  const bubbleStyle = React.useMemo(() => {
    if (!selectedSelection || !promptBoxRef.current) {
      return null
    }

    const boxRect = promptBoxRef.current.getBoundingClientRect()
    const bubbleWidth = 132
    const bubbleLeft = clamp(
      selectedSelection.rect.left - boxRect.left + selectedSelection.rect.width / 2 - bubbleWidth / 2,
      12,
      Math.max(12, boxRect.width - bubbleWidth - 12),
    )
    const bubbleTop = clamp(
      selectedSelection.rect.top - boxRect.top - 56,
      -60,
      Math.max(-60, boxRect.height - 56),
    )

    return {
      left: `${bubbleLeft}px`,
      top: `${bubbleTop}px`,
    }
  }, [selectedSelection])

  // Close on Escape key press
  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false)
        setSelectionState(null)
        selectionStateRef.current = null
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  if (!open) return null

  const modalContent = (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="relative flex h-full w-full max-w-none flex-col overflow-hidden rounded-[32px] border border-border/70 bg-background shadow-2xl">
        <div className="flex h-full min-h-0 flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex w-full max-w-none items-start justify-between gap-4">
            <div className="space-y-1 text-left">
              <h2 className="text-base font-semibold sm:text-lg text-foreground">
                Save example
              </h2>
              <p className="text-xs text-muted-foreground">
                Turn this generation into a one-click starter without naming it manually.
              </p>
            </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X className="size-4" weight="bold" />
              </Button>
            </div>
          </div>

          {/* 1 Column Layout containing 3 elements */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-none flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
              
              {/* Element 1: EXAMPLE CARD (Square image with overlays, no title/description text) */}
              <section className="flex justify-center">
                <div className="relative mx-auto overflow-hidden rounded-3xl border border-border/70 bg-zinc-950 shadow-sm max-h-[40vh] min-h-[180px] w-fit flex items-center justify-center">
                  {snapshot?.coverUrl ? (
                    <img
                      src={snapshot.coverUrl}
                      alt="Example preview"
                      className="max-h-[40vh] min-h-[180px] w-auto h-auto object-contain"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                      <FolderOpen className="size-10 opacity-60" />
                      <p className="text-sm">No cover image available</p>
                    </div>
                  )}

                  {/* Badges overlaying at the top */}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1 z-10">
                    {selectedModel && (
                      <Badge variant="secondary" className="bg-background/90 text-[10px] uppercase tracking-wide text-foreground backdrop-blur-sm">
                        {selectedModel.replace(/^.*\//, "")}
                      </Badge>
                    )}
                    {selectedAspectRatio && (
                      <Badge variant="outline" className="border-white/20 bg-black/45 text-[10px] uppercase tracking-wide text-white backdrop-blur-sm">
                        {selectedAspectRatio}
                      </Badge>
                    )}
                    <Badge variant="outline" className="border-white/20 bg-black/45 text-[10px] uppercase tracking-wide text-white backdrop-blur-sm">
                      {selectedNumImages} {selectedNumImages === 1 ? "image" : "images"}
                    </Badge>
                    {enhancePrompt && (
                      <Badge variant="outline" className="border-white/20 bg-black/45 text-[10px] uppercase tracking-wide text-white backdrop-blur-sm">
                        Enhance
                      </Badge>
                    )}
                    {draftInputs.length > 0 && (
                      <Badge variant="outline" className="border-white/20 bg-black/45 text-[10px] uppercase tracking-wide text-white backdrop-blur-sm">
                        {draftInputs.length} variable{draftInputs.length === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>

                  {/* Prompt overlaying at bottom */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 text-white z-10">
                    <p className="line-clamp-3 text-xs leading-relaxed text-white/90">
                      {prompt || "Describe your generation..."}
                    </p>
                  </div>
                </div>
              </section>

              {/* Element 2: INPUT CARD (Variables manager) */}
              <section className="space-y-3">
                <Card className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Variables
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Create placeholders by highlighting prompt text or clicking attachments below.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full h-8 text-xs"
                      onClick={() => handleAddManualTextInput()}
                    >
                      <Plus className="mr-1.5 size-3" weight="bold" />
                      Add variable
                    </Button>
                  </div>

                  {draftInputs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground">
                      No inputs yet. Highlight text in the prompt editor or click attachments to define variable slots.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {draftInputs.map((input) => {
                        const isImageInput = input.kind === "image"
                        return (
                          <div
                            key={input.id}
                            className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-2.5"
                          >
                            <div className="flex flex-wrap items-center gap-3">
                              <Badge
                                variant="secondary"
                                className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wide"
                              >
                                {isImageInput ? "Media" : "Text"}
                              </Badge>
                              <div className="min-w-[120px] flex-1">
                                <Input
                                  value={input.label}
                                  onChange={(event) => {
                                    const next = event.target.value
                                    setDraftInputs((current) =>
                                      current.map((row) =>
                                        row.id === input.id ? { ...row, label: next } : row,
                                      ),
                                    )
                                  }}
                                  className="h-8 rounded-full text-xs"
                                  placeholder={isImageInput ? "Reference image" : "Variable name"}
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-xs">
                                  <Switch
                                    checked={input.required !== false}
                                    onCheckedChange={(checked) => {
                                      setDraftInputs((current) =>
                                        current.map((row) =>
                                          row.id === input.id ? { ...row, required: checked } : row,
                                        ),
                                      )
                                    }}
                                    className="scale-90"
                                  />
                                  <span className="text-[11px] text-muted-foreground">Required</span>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => handleRemoveInput(input.id)}
                                  aria-label={`Remove ${input.label}`}
                                >
                                  <Trash className="size-3.5" />
                                </Button>
                              </div>
                            </div>

                            {isImageInput && input.sourceAttachment && (
                              <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-1.5">
                                <img
                                  src={input.sourceAttachment.url}
                                  alt={input.label}
                                  className="size-10 rounded-lg object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[11px] font-medium text-foreground">
                                    {input.sourceAttachment.title?.trim() || "Reference media"}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    Saved as a media input slot
                   </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Card>
              </section>

              {/* Element 3: PROMPT BOX CARD (Replica of InfluencerInputBox) */}
              <section className="space-y-3">
                <div ref={promptBoxRef} className="relative">
                  <Card className="w-full relative transition-colors bg-background/95 backdrop-blur-sm overflow-visible border border-border/70 rounded-[30px]">
                    <CardContent className="p-2 flex flex-col gap-1.5">
                      
                      {/* Image attachments list: displays thumbnails styled like InfluencerInputBox reference images */}
                      {attachments.length > 0 && (
                        <div className="relative w-full flex gap-2 flex-wrap px-2 pt-2">
                          {attachments.map((attachment) => (
                            <button
                              key={attachment.id}
                              type="button"
                              className="group relative overflow-hidden rounded-xl border border-border/70 bg-muted/20 text-left transition-transform hover:-translate-y-0.5"
                              onClick={() => handleAttachmentAsInput(attachment.id)}
                              title="Click to turn into a media input slot"
                            >
                              <img
                                src={attachment.url}
                                alt={attachment.title?.trim() || "Prompt media"}
                                className="h-[60px] w-auto max-w-[120px] object-cover"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-[9px] uppercase font-bold text-white tracking-wide text-center px-1">
                                  Make Slot
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Text editor and action buttons side-by-side */}
                      <div className="flex items-start gap-2 pt-1 px-2">
                        <div className="flex-1 relative">
                          {/* Selection Bubble */}
                          {selectionState && bubbleStyle && (
                            <div
                              className="pointer-events-none absolute z-20"
                              style={bubbleStyle}
                            >
                              <Button
                                type="button"
                                size="sm"
                                className="pointer-events-auto h-8 rounded-full px-3 shadow-lg bg-primary text-primary-foreground"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={handleMakeVariable}
                              >
                                <Sparkle className="mr-1.5 size-3.5" weight="fill" />
                                Make variable
                              </Button>
                            </div>
                          )}

                          <div className="rounded-[24px] border border-border/70 bg-background p-3.5 min-h-[120px] relative">
                            <div
                              ref={promptEditorRef}
                              contentEditable
                              suppressContentEditableWarning
                              spellCheck
                              className={cn(
                                "min-h-[100px] w-full whitespace-pre-wrap break-words px-1 py-1 text-sm leading-6 outline-none",
                                "selection:bg-primary/25",
                              )}
                              onInput={handlePromptInput}
                              onMouseUp={updateSelectionFromDOM}
                              onKeyUp={updateSelectionFromDOM}
                              onBlur={() => {
                                window.setTimeout(() => {
                                  const root = promptEditorRef.current
                                  if (!root || root.contains(document.activeElement)) return
                                  updateSelectionFromDOM()
                                }, 0)
                              }}
                              onPaste={handlePromptPaste}
                            />
                            {prompt.trim().length === 0 && (
                              <div className="pointer-events-none absolute left-4.5 top-4.5 text-sm leading-6 text-muted-foreground/70">
                                Describe what the AI should do. Highlight any text to turn it into a variable.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Save Actions Stack on the right */}
                        <div className="shrink-0 flex flex-col gap-2">
                          <Button
                            onClick={() => void handleSave()}
                            disabled={isSaving || prompt.trim().length === 0}
                            className="bg-primary hover:bg-primary/80 text-primary-foreground font-semibold h-10 min-w-[100px] text-xs px-4 py-6 rounded-full transition-all duration-300"
                          >
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-sm font-semibold">{isSaving ? "Saving..." : "Save"}</span>
                              <div className="flex items-center gap-0.5">
                                <Sparkle size={8} weight="fill" />
                                <span className="text-[10px]">Example</span>
                              </div>
                            </div>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="h-10 text-xs rounded-full border border-border/70 hover:bg-muted"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>

                      {/* Controls Bottom Row with visibility option */}
                      <div className="flex items-center gap-1.5 flex-wrap px-2 pb-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full bg-muted hover:bg-muted/80"
                              aria-label="Add variable"
                            >
                              <Plus className="size-3.5" weight="bold" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" side="top" sideOffset={8}>
                            <DropdownMenuItem onClick={() => handleAddManualTextInput()}>
                              <Plus className="mr-2 size-4" />
                              Add text variable
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                          <SelectTrigger className="h-7 text-xs w-fit min-w-[140px] px-2 rounded-full">
                            <SelectValue placeholder="Model" />
                          </SelectTrigger>
                          <SelectContent position="popper" side="top" sideOffset={4}>
                            {modelsLoading && selectedModelOptions.length === 0 ? (
                              <SelectItem value="loading" disabled>
                                Loading models...
                              </SelectItem>
                            ) : (
                              selectedModelOptions.map((model) => (
                                <SelectItem key={model.identifier} value={model.identifier}>
                                  {model.name || model.identifier}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>

                        <Select value={selectedAspectRatio} onValueChange={setSelectedAspectRatio}>
                          <SelectTrigger className="h-7 text-xs w-fit min-w-[110px] px-2 rounded-full">
                            <SelectValue placeholder="Aspect ratio" />
                          </SelectTrigger>
                          <SelectContent position="popper" side="top" sideOffset={4}>
                            {ASPECT_RATIO_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={String(selectedNumImages)}
                          onValueChange={(value) => setSelectedNumImages(Number(value))}
                        >
                          <SelectTrigger className="h-7 text-xs w-fit min-w-[80px] px-2 rounded-full">
                            <SelectValue placeholder="Images" />
                          </SelectTrigger>
                          <SelectContent position="popper" side="top" sideOffset={4}>
                            {Array.from(
                              new Set([...NUM_IMAGES_OPTIONS, selectedNumImages].filter(Boolean)),
                            ).map((value) => (
                              <SelectItem key={value} value={String(value)}>
                                {value} {value === 1 ? "image" : "images"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <ImageEnhanceSwitch
                          checked={enhancePrompt}
                          onCheckedChange={setEnhancePrompt}
                          className="h-7 px-2.5 border border-border/70 rounded-full bg-background/50 hover:bg-background/80"
                        />

                        {/* Visibility options integrated into the options row */}
                        <Select value={visibility} onValueChange={(value) => setVisibility(value as SaveExampleVisibility)}>
                          <SelectTrigger className="h-7 text-xs w-fit min-w-[110px] px-2 rounded-full border border-border/70 bg-background/50">
                            <SelectValue placeholder="Visibility" />
                          </SelectTrigger>
                          <SelectContent position="popper" side="top" sideOffset={4}>
                            <SelectItem value="private">Private</SelectItem>
                            <SelectItem value="public">Public</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                    </CardContent>
                  </Card>
                </div>
              </section>

            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (!mounted || typeof document === "undefined") return null
  return createPortal(modalContent, document.body)
}

