"use client"

import * as React from "react"
import Link from "next/link"
import { FilePlus, FolderOpen, PaperPlaneTilt, Plus } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import { AspectRatioSelector } from "@/components/shared/selectors/aspect-ratio-selector"
import { DEFAULT_IMAGE_MODEL_IDENTIFIER } from "@/lib/constants/models"
import { getActiveModelMetadata, type ModelMetadata } from "@/lib/constants/model-metadata"
import { getDefaultAspectRatioForModel } from "@/lib/utils/aspect-ratios"
import type { Model } from "@/lib/types/models"
import { cn } from "@/lib/utils"

const MOCK_PLACEHOLDER =
  "Describe your image, use / for presets and @ for brand kits & assets."

const DEFAULT_SEND_HREF = "/login"

function formatModelName(identifier: string, name: string): string {
  if (name && !name.includes("/")) {
    return name
  }
  const parts = identifier.split("/")
  const shortIdentifier = parts[parts.length - 1]
  return shortIdentifier
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function metadataToModels(metadata: ModelMetadata[]): Model[] {
  return metadata.map((m) => ({
    id: m.id,
    identifier: m.identifier,
    name: m.name,
    description: m.description,
    type: m.type,
    provider: m.provider,
    is_active: m.is_active,
    model_cost: m.model_cost,
    parameters: { parameters: [] },
    created_at: "",
    updated_at: "",
    aspect_ratios: m.aspect_ratios,
    default_aspect_ratio: m.aspect_ratios[0],
  }))
}

type HeroMockPromptBoxProps = {
  className?: string
  /** Where Send navigates (defaults to login) */
  sendHref?: string
}

/**
 * Landing hero preview of the /image composer: model and aspect controls work locally for UI only.
 * Send navigates to login.
 */
export function HeroMockPromptBox({ className, sendHref = DEFAULT_SEND_HREF }: HeroMockPromptBoxProps) {
  const models = React.useMemo(() => metadataToModels(getActiveModelMetadata("image")), [])

  const [selectedModel, setSelectedModel] = React.useState("")
  const [selectedAspectRatio, setSelectedAspectRatio] = React.useState("match_input_image")
  const [prompt, setPrompt] = React.useState("")
  const hasPromptText = prompt.trim().length > 0

  React.useEffect(() => {
    if (models.length === 0 || selectedModel) return
    const id =
      models.find((m) => m.identifier === DEFAULT_IMAGE_MODEL_IDENTIFIER)?.identifier ?? models[0].identifier
    setSelectedModel(id)
    const m = models.find((x) => x.identifier === id)
    if (m) setSelectedAspectRatio(getDefaultAspectRatioForModel(m))
  }, [models, selectedModel])

  const selectedModelObject = React.useMemo(
    () => models.find((m) => m.identifier === selectedModel) ?? null,
    [models, selectedModel]
  )

  const handleModelChange = React.useCallback(
    (identifier: string) => {
      setSelectedModel(identifier)
      const next = models.find((m) => m.identifier === identifier)
      if (next) {
        setSelectedAspectRatio(getDefaultAspectRatioForModel(next))
      }
    },
    [models]
  )

  return (
    <Card
      className={cn(
        "relative mx-auto mb-2 w-full max-w-sm sm:max-w-lg lg:max-w-4xl transition-colors overflow-visible border-border bg-card/95 shadow-lg backdrop-blur-sm",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-4 rounded-b-2xl bg-linear-to-t from-card to-transparent sm:h-[18px]"
      />
      <CardContent className="relative z-10 flex flex-col gap-1.5 p-2">
        <p className="sr-only">
          Example prompt layout. Model and aspect settings are for preview only. The send button opens the sign-in page.
        </p>
        <div className="flex items-start gap-2 px-2 pt-1">
          <div className="min-w-0 flex-1">
            <textarea
              name="hero-mock-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              aria-label="Prompt preview: type to try the layout; send opens sign-in"
              className="max-h-[120px] min-h-[60px] w-full resize-none overflow-y-auto border-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
              placeholder={MOCK_PLACEHOLDER}
            />
          </div>
          <div className="shrink-0">
            <div
              className={cn(
                "relative inline-block transition-all duration-300",
                "before:absolute before:inset-[-12px] before:-z-10 before:rounded-full before:bg-primary before:blur-[15px] before:content-[''] before:transition-opacity before:duration-300",
                "max-md:before:inset-[-6px] max-md:before:blur-[8px]",
                hasPromptText ? "before:opacity-55" : "before:opacity-0"
              )}
            >
              <Button
                asChild
                size="icon-lg"
                className={cn(
                  "relative z-0 bg-primary text-primary-foreground transition-all duration-300 hover:bg-primary/80",
                  "max-md:size-5 max-md:rounded-full [&_svg]:max-md:size-3",
                  hasPromptText &&
                    "shadow-[0_0_28px_hsl(var(--primary)/0.55)] ring-2 ring-primary/35 ring-offset-2 ring-offset-background dark:ring-offset-background max-md:ring-1 max-md:ring-offset-1"
                )}
              >
                <Link href={sendHref} aria-label="Send, opens sign-in">
                  <PaperPlaneTilt className="size-5" weight="fill" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-muted hover:bg-muted/80 max-md:size-[18px] max-md:min-h-0 [&_svg]:max-md:size-2.5"
                aria-label="Add reference image"
              >
                <Plus className="size-3.5" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem disabled className="opacity-70">
                <FilePlus className="mr-2 size-4" />
                Upload Reference Image
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="opacity-70">
                <FolderOpen className="mr-2 size-4" />
                Select Asset
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {models.length > 0 && selectedModel && (
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger
                id="hero-mock-model-select"
                className="h-7 w-fit min-w-0 max-w-[min(52vw,14rem)] px-2 text-xs sm:max-w-[16rem]"
              >
                <SelectValue placeholder="Model">
                  {selectedModelObject ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <ModelIcon identifier={selectedModelObject.identifier} size={16} />
                      <span className="truncate">
                        {formatModelName(selectedModelObject.identifier, selectedModelObject.name)}
                      </span>
                    </div>
                  ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent position="popper" side="top" sideOffset={4} className="max-h-[min(50vh,280px)]">
                {models.map((model) => (
                  <SelectItem key={model.identifier} value={model.identifier}>
                    <div className="flex min-w-0 max-w-[min(85vw,22rem)] items-center gap-3 py-0.5">
                      <div className="shrink-0 rounded-md border border-border bg-muted/30 p-1.5">
                        <ModelIcon identifier={model.identifier} size={20} />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-semibold text-sm">
                          {formatModelName(model.identifier, model.name)}
                        </span>
                        {model.description ? (
                          <span className="line-clamp-2 text-xs text-muted-foreground">{model.description}</span>
                        ) : null}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <AspectRatioSelector
            model={selectedModelObject}
            value={selectedAspectRatio}
            onValueChange={setSelectedAspectRatio}
          />
        </div>
      </CardContent>
    </Card>
  )
}
