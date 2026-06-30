"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { PencilSimple, Sparkle, UploadSimple, X } from "@phosphor-icons/react"

import type { SavedExample } from "@/lib/examples/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface SavedExamplesGalleryProps {
  examples: SavedExample[]
  isLoading?: boolean
  className?: string
  columnCount?: number
  onUseExample?: (
    example: SavedExample,
    promptOverride: string,
    mediaInputs: Record<string, { file?: File; url: string }>
  ) => void
}

function getExampleCover(example: SavedExample) {
  return example.cover_url || "/hero_showcase_images/image_generation.png"
}

function formatSettingLabel(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value ? "On" : "Off"
  if (typeof value === "string" || typeof value === "number") return String(value)
  return null
}

function promptPreview(prompt: string) {
  const trimmed = prompt.trim()
  if (!trimmed) return "No prompt"
  if (trimmed.length <= 180) return trimmed
  return `${trimmed.slice(0, 177)}...`
}

export function SavedExamplesGallery({
  examples,
  isLoading = false,
  className,
  columnCount = 2,
  onUseExample,
}: SavedExamplesGalleryProps) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const [activeExample, setActiveExample] = React.useState<SavedExample | null>(null)
  const [draftPrompt, setDraftPrompt] = React.useState("")
  const [inputValues, setInputValues] = React.useState<Record<string, string | File | null>>({})
  const [isEditingPrompt, setIsEditingPrompt] = React.useState(false)

  React.useEffect(() => {
    if (!activeExample) {
      setInputValues({})
      setIsEditingPrompt(false)
      return
    }
    setDraftPrompt(activeExample.prompt)
    setIsEditingPrompt(false)

    const initialValues: Record<string, string | File | null> = {}
    activeExample.inputs.forEach((input) => {
      initialValues[input.id] = null
    })
    setInputValues(initialValues)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveExample(null)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeExample])

  const openExample = React.useCallback((example: SavedExample) => {
    setActiveExample(example)
  }, [])

  const activeColumnCount = Math.min(6, Math.max(1, columnCount))
  const gridColsClass = {
    1: "grid-cols-1 max-w-2xl mx-auto",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
  }[activeColumnCount]

  const handleUseExample = React.useCallback(() => {
    if (!activeExample) return

    // 1. Validate required inputs
    for (const input of activeExample.inputs) {
      if (input.required) {
        const val = inputValues[input.id]
        if (val == null || (typeof val === "string" && !val.trim())) {
          toast.error(`Please fill in the required field: ${input.label}`)
          return
        }
      }
    }

    // 2. Resolve the prompt text (substitute text input variables)
    let resolvedPrompt = draftPrompt
    activeExample.inputs.forEach((input) => {
      if (input.kind === "text") {
        const val = inputValues[input.id] || ""
        resolvedPrompt = resolvedPrompt.replace(new RegExp(`\\{\\{${input.id}\\}\\}`, 'g'), String(val))
      }
    })

    // 3. Extract uploaded media files / URLs
    const mediaInputs: Record<string, { file?: File; url: string }> = {}
    activeExample.inputs.forEach((input) => {
      if (input.kind === "image" || input.kind === "video" || input.kind === "audio") {
        const val = inputValues[input.id]
        if (val instanceof File) {
          mediaInputs[input.id] = { file: val, url: URL.createObjectURL(val) }
        } else if (typeof val === "string" && val.startsWith("http")) {
          mediaInputs[input.id] = { url: val }
        }
      }
    })

    onUseExample?.(activeExample, resolvedPrompt, mediaInputs)
    setActiveExample(null)
  }, [activeExample, draftPrompt, inputValues, onUseExample])

  return (
    <>
      <div className={cn("space-y-3", className)}>
        {isLoading ? (
          <div className={cn("grid gap-2.5 sm:gap-3", gridColsClass)}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`example-skeleton-${index}`}
                className={cn(
                  "aspect-square animate-pulse rounded-2xl bg-muted/40",
                  activeColumnCount === 1 && "min-h-[42vh] aspect-auto",
                )}
              />
            ))}
          </div>
        ) : examples.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-sm text-muted-foreground">
            No saved examples yet. Save one from a good generation to start building a reusable library.
          </div>
        ) : (
          <div className={cn("grid gap-2.5 sm:gap-3", gridColsClass)}>
            {examples.map((example) => {
              const cover = getExampleCover(example)
              const defaultModel = typeof example.default_settings.model === "string" ? example.default_settings.model : null

              return (
                <div
                  key={example.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openExample(example)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      openExample(example)
                    }
                  }}
                  className="group cursor-pointer text-left outline-none"
                >
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5">
                    <div className={cn("relative aspect-square bg-zinc-900", activeColumnCount === 1 && "min-h-[42vh] aspect-auto")}>
                      <img
                        src={cover}
                        alt="Example cover"
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]"
                        loading="lazy"
                      />
                      
                      {/* Dark overlay showing only on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

                      {/* Badges overlaying at top */}
                      <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <Badge variant="secondary" className="bg-background/90 text-[10px] uppercase tracking-wide text-foreground backdrop-blur-sm">
                          {example.surface}
                        </Badge>
                        {example.visibility === "public" && (
                          <Badge variant="outline" className="border-white/20 bg-black/45 text-[10px] uppercase tracking-wide text-white backdrop-blur-sm">
                            public
                          </Badge>
                        )}
                        {defaultModel && (
                          <Badge variant="outline" className="border-white/20 bg-black/45 text-[10px] uppercase tracking-wide text-white backdrop-blur-sm">
                            {defaultModel.replace(/^.*\//, "")}
                          </Badge>
                        )}
                      </div>

                      {/* Center Glass Button */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-md transition-all duration-200 hover:bg-white/20 active:bg-white/30 shadow-lg translate-y-1 group-hover:translate-y-0"
                          onClick={(event) => {
                            event.stopPropagation()
                            openExample(example)
                          }}
                        >
                          <Sparkle className="size-3.5 text-primary-foreground" weight="fill" />
                          <span>Recreate Example</span>
                        </button>
                      </div>

                      {/* Prompt overlaying at bottom */}
                      <div className="absolute inset-x-0 bottom-0 p-3.5 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <p className="line-clamp-3 text-xs leading-relaxed text-white/90">{promptPreview(example.prompt)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {mounted && typeof document !== "undefined" && activeExample
        ? createPortal(
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 md:p-10">
              <div className="relative flex h-full w-full max-w-none flex-col overflow-hidden rounded-[32px] border border-border/70 bg-background shadow-2xl">
                <div className="flex h-full min-h-0 flex-col bg-background">
            {/* Header */}
            <div className="border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
              <div className="mx-auto flex w-full max-w-none items-start justify-between gap-4">
                <div className="space-y-1 text-left">
                  <h2 className="text-base font-semibold sm:text-lg text-foreground">
                    Use Example
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Adjust variables and prompt before adding them to your composer.
                  </p>
                </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 rounded-full"
                    onClick={() => setActiveExample(null)}
                    aria-label="Close"
                  >
                    <X className="size-4" weight="bold" />
                  </Button>
                </div>
              </div>

              {/* Scrollable Layout Content */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex w-full max-w-none flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                  
                  {/* Element 1: EXAMPLE CARD (Cover preview card) */}
                  <section className="flex justify-center">
                    <div className="relative mx-auto overflow-hidden rounded-3xl border border-border/70 bg-zinc-950 shadow-sm max-h-[40vh] min-h-[180px] w-fit flex items-center justify-center">
                      <img
                        src={getExampleCover(activeExample)}
                        alt="Active example preview"
                        className="max-h-[40vh] min-h-[180px] w-auto h-auto object-contain"
                      />
                      {/* Badges overlaying at the top */}
                      <div className="absolute left-3 top-3 flex flex-wrap gap-1 z-10">
                        <Badge variant="secondary" className="bg-background/90 text-[10px] uppercase tracking-wide text-foreground backdrop-blur-sm">
                          {activeExample.surface}
                        </Badge>
                        <Badge variant="outline" className="border-white/20 bg-black/45 text-[10px] uppercase tracking-wide text-white backdrop-blur-sm">
                          {activeExample.cover_kind}
                        </Badge>
                        {Object.entries(activeExample.default_settings)
                          .filter(([key]) => key !== "model_parameters")
                          .map(([key, value]) => {
                            const label = formatSettingLabel(value)
                            if (!label) return null
                            return (
                              <Badge key={key} variant="outline" className="border-white/20 bg-black/45 text-[10px] uppercase tracking-wide text-white backdrop-blur-sm">
                                {key}: {label}
                              </Badge>
                            )
                          })}
                      </div>
                      {/* Prompt overlaying at bottom */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 text-white z-10">
                        <p className="line-clamp-3 text-xs leading-relaxed text-white/90 text-left">
                          {draftPrompt || "No prompt description"}
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Element 2: INPUT CARD (Variables / Input Slots Manager) */}
                  {activeExample.inputs && activeExample.inputs.length > 0 && (
                    <section className="space-y-3">
                      <Card className="rounded-3xl border border-border/70 bg-card py-2.5 px-3.5 shadow-sm">
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <div className="space-y-0.5">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground text-left">
                              Input variables
                            </h3>
                            <p className="text-xs text-muted-foreground text-left">
                              Fill in these placeholder values for this example.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {activeExample.inputs.map((input) => {
                            const isMedia = input.kind === "image" || input.kind === "video" || input.kind === "audio"
                            
                            if (isMedia) {
                              const val = inputValues[input.id]
                              const hasVal = val instanceof File || (typeof val === "string" && val.startsWith("http"))
                              const isImage = input.kind === "image"
                              const previewUrl = val instanceof File ? URL.createObjectURL(val) : (typeof val === "string" ? val : null)

                              return (
                                <div key={input.id} className="space-y-1 text-left">
                                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {input.label} {input.required && <span className="text-destructive">*</span>}
                                  </label>
                                  <div className="relative flex min-h-[85px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background py-2 px-3 transition-colors">
                                    {hasVal ? (
                                      <div className="relative flex w-full flex-col items-center gap-2">
                                        {isImage && previewUrl ? (
                                          <img
                                            src={previewUrl}
                                            alt=""
                                            className="max-h-24 rounded-lg object-contain"
                                          />
                                        ) : (
                                          <p className="text-xs text-muted-foreground truncate max-w-full px-2 text-center">
                                            {val instanceof File ? val.name : "Asset selected"}
                                          </p>
                                        )}
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="absolute right-0 top-0 size-7 rounded-full hover:bg-muted"
                                          onClick={() => setInputValues((prev) => ({ ...prev, [input.id]: null }))}
                                        >
                                          <X className="size-3.5" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center gap-1">
                                        <UploadSimple className="size-4 text-muted-foreground/60" />
                                        <span className="text-[11px] text-muted-foreground text-center">
                                          Upload a reference {input.kind}
                                        </span>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="xs"
                                          className="rounded-full h-7 text-[11px]"
                                          onClick={() => {
                                            const fileInput = document.createElement("input")
                                            fileInput.type = "file"
                                            fileInput.accept = input.kind === "image" ? "image/*" : input.kind === "video" ? "video/*" : "audio/*"
                                            fileInput.onchange = (e) => {
                                              const file = (e.target as HTMLInputElement).files?.[0]
                                              if (file) {
                                                setInputValues((prev) => ({ ...prev, [input.id]: file }))
                                              }
                                            }
                                            fileInput.click()
                                          }}
                                        >
                                          Choose File
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            }

                            // Text input
                            return (
                              <div key={input.id} className="space-y-1 text-left">
                                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {input.label} {input.required && <span className="text-destructive">*</span>}
                                </label>
                                <Input
                                  value={String(inputValues[input.id] ?? "")}
                                  onChange={(e) => setInputValues((prev) => ({ ...prev, [input.id]: e.target.value }))}
                                  placeholder={`Enter ${input.label.toLowerCase()}...`}
                                  className="rounded-full bg-background text-xs h-8"
                                />
                              </div>
                            )
                          })}
                        </div>
                      </Card>
                    </section>
                  )}

                  {/* Element 3: PROMPT BOX CARD (Replica style editor) */}
                  <section className="space-y-3">
                    <Card className="w-full relative transition-colors bg-background/95 backdrop-blur-sm overflow-visible border border-border/70 rounded-[30px]">
                      <CardContent className="p-2 flex flex-col gap-1.5">
                        
                        {/* Text editor and action buttons side-by-side */}
                        <div className="flex items-start gap-2 pt-1 px-2">
                          <div className="flex-1 relative">
                            <div className="space-y-1.5 text-left">
                              <div className="flex items-center justify-between pl-2 pr-1 mb-1">
                                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Prompt Text
                                </label>
                                {!isEditingPrompt && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setIsEditingPrompt(true)}
                                    className="h-6 rounded-full px-2.5 text-[10px] uppercase font-semibold text-primary hover:text-primary/80 hover:bg-primary/10 flex items-center gap-1"
                                  >
                                    <PencilSimple size={12} weight="bold" />
                                    <span>Edit</span>
                                  </Button>
                                )}
                              </div>
                              {!isEditingPrompt ? (
                                <div className="min-h-[110px] w-full rounded-[24px] border border-border/70 bg-muted/15 p-3.5 text-sm leading-6 text-foreground/90 text-left select-none cursor-default flex flex-col justify-start">
                                  <p className="line-clamp-3 break-words whitespace-pre-wrap">
                                    {draftPrompt || "No prompt description"}
                                  </p>
                                </div>
                              ) : (
                                <div className="relative">
                                  <Textarea
                                    value={draftPrompt}
                                    onChange={(e) => setDraftPrompt(e.target.value)}
                                    className="min-h-[110px] w-full rounded-[24px] border border-border/70 bg-background p-3.5 text-sm leading-6 outline-none resize-none"
                                    placeholder="Edit the prompt before using the example"
                                    autoFocus
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Save Actions Stack on the right */}
                          <div className="shrink-0 flex flex-col gap-2 pt-5">
                            <Button
                              onClick={handleUseExample}
                              className="bg-primary hover:bg-primary/80 text-primary-foreground font-semibold h-10 min-w-[100px] text-xs px-4 py-6 rounded-full transition-all duration-300"
                            >
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-sm font-semibold">Use</span>
                                <div className="flex items-center gap-0.5">
                                  <Sparkle size={8} weight="fill" />
                                  <span className="text-[10px]">Example</span>
                                </div>
                              </div>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setActiveExample(null)}
                              className="h-10 text-xs rounded-full border border-border/70 hover:bg-muted"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>

                      </CardContent>
                    </Card>
                  </section>

                </div>
              </div>
            </div>
            </div>
          </div>,
          document.body
        )
      : null}
    </>
  )
}

