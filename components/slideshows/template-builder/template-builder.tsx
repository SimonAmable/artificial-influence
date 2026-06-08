"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CircleNotch, FloppyDisk } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { AdvancedTextSettings } from "@/components/slideshows/template-builder/advanced-text-settings"
import { CharacterAssetPicker } from "@/components/slideshows/template-builder/character-asset-picker"
import { SlideDetailPanel } from "@/components/slideshows/template-builder/slide-detail-panel"
import { SlideStructureRail } from "@/components/slideshows/template-builder/slide-structure-rail"
import { TemplateToolbar } from "@/components/slideshows/template-builder/template-toolbar"
import {
  blueprintFromTemplate,
  buildSavePayload,
  createInitialBlueprint,
  normalizeBlueprint,
} from "@/lib/slideshows/template-builder-utils"
import type { SlideshowCollection } from "@/lib/slideshow/types"
import type {
  SlideshowAspectRatio,
  SlideshowBlueprint,
  SlideshowTemplate,
} from "@/lib/slideshows/types"
import { cn } from "@/lib/utils"

type BrandKitOption = { id: string; name: string; isDefault?: boolean }

const fieldLabelClass = "text-xs font-medium text-muted-foreground"
const fieldControlClass =
  "h-10 border-0 bg-background/50 shadow-none ring-1 ring-inset ring-border/40 transition-colors hover:bg-background/70 focus-visible:ring-ring/30"
const panelClass = "rounded-2xl bg-muted/15 ring-1 ring-inset ring-border/40"

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || "Request failed.")
  return body as T
}

export function TemplateBuilder({
  initialTemplate,
  collections,
  onSaved,
  onSaveAndRun,
  backHref = "/slideshows?tab=templates",
}: {
  initialTemplate?: SlideshowTemplate
  collections: SlideshowCollection[]
  onSaved?: (template: SlideshowTemplate) => void
  onSaveAndRun?: (template: SlideshowTemplate) => void
  backHref?: string
}) {
  const router = useRouter()
  const isEdit = Boolean(initialTemplate)

  const [name, setName] = React.useState(initialTemplate?.name ?? "Untitled template")
  const [description, setDescription] = React.useState(initialTemplate?.description ?? "")
  const [aspectRatio, setAspectRatio] = React.useState<SlideshowAspectRatio>(
    initialTemplate?.aspectRatio ?? "9:16",
  )
  const [blueprint, setBlueprint] = React.useState<SlideshowBlueprint>(() =>
    initialTemplate ? blueprintFromTemplate(initialTemplate) : createInitialBlueprint(),
  )
  const [selectedSlideId, setSelectedSlideId] = React.useState<string | null>(
    () => blueprint.slides[0]?.id ?? null,
  )
  const [brandKits, setBrandKits] = React.useState<BrandKitOption[]>([])
  const [busy, setBusy] = React.useState<"save" | "run" | null>(null)

  React.useEffect(() => {
    void fetch("/api/brand-kits")
      .then((response) => response.ok ? response.json() : { kits: [] })
      .then((data: { kits?: Array<{ id: string; name: string; isDefault?: boolean }> }) => {
        setBrandKits((data.kits ?? []).map((kit) => ({
          id: kit.id,
          name: kit.name,
          isDefault: kit.isDefault,
        })))
      })
      .catch(() => setBrandKits([]))
  }, [])

  React.useEffect(() => {
    if (blueprint.slides.some((slide) => slide.id === selectedSlideId)) return
    setSelectedSlideId(blueprint.slides[0]?.id ?? null)
  }, [blueprint.slides, selectedSlideId])

  const selectedSlide = blueprint.slides.find((slide) => slide.id === selectedSlideId) ?? null
  const selectedSlideIndex = selectedSlide
    ? blueprint.slides.findIndex((slide) => slide.id === selectedSlide.id)
    : -1

  function updateSlide(nextSlide: SlideshowBlueprint["slides"][number]) {
    setBlueprint((current) => ({
      ...current,
      slides: current.slides.map((slide) => slide.id === nextSlide.id ? nextSlide : slide),
    }))
  }

  function updateSettings(patch: Partial<SlideshowBlueprint["settings"]>) {
    setBlueprint((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }))
  }

  async function saveTemplate(): Promise<SlideshowTemplate | null> {
    if (name.trim().length < 1) {
      toast.error("Add a template name.")
      return null
    }

    const payload = buildSavePayload({
      name,
      description,
      aspectRatio,
      blueprint: normalizeBlueprint(blueprint),
    })

    if (isEdit && initialTemplate) {
      const { template } = await readJson<{ template: SlideshowTemplate }>(
        await fetch(`/api/slideshows/templates/${initialTemplate.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      )
      return template
    }

    const { template } = await readJson<{ template: SlideshowTemplate }>(
      await fetch("/api/slideshows/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, origin: "saved" }),
      }),
    )
    return template
  }

  async function handleSave() {
    setBusy("save")
    try {
      const template = await saveTemplate()
      if (!template) return
      toast.success(isEdit ? "Template updated." : "Template saved.")
      onSaved?.(template)
      if (!isEdit) router.replace(`/slideshows/templates/${template.id}/edit`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template.")
    } finally {
      setBusy(null)
    }
  }

  async function handleSaveAndRun() {
    setBusy("run")
    try {
      const template = await saveTemplate()
      if (!template) return
      onSaveAndRun?.(template)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-20">
      <div className="sticky top-0 z-30 -mx-5 mb-8 border-b border-border/30 bg-background/75 px-5 py-4 backdrop-blur-xl supports-backdrop-filter:bg-background/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              asChild
            >
              <Link href={backHref}><ArrowLeft className="h-4 w-4" weight="bold" /></Link>
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                Template builder
              </p>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-0.5 h-auto max-w-lg border-0 bg-transparent px-0 text-xl font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0 sm:text-2xl"
                placeholder="Untitled template"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              disabled={busy !== null}
              onClick={() => void handleSave()}
            >
              {busy === "save"
                ? <CircleNotch className="mr-1.5 h-4 w-4 animate-spin" />
                : <FloppyDisk className="mr-1.5 h-4 w-4" />}
              Save
            </Button>
            {onSaveAndRun ? (
              <Button
                size="sm"
                className="rounded-full px-4"
                disabled={busy !== null}
                onClick={() => void handleSaveAndRun()}
              >
                {busy === "run" ? <CircleNotch className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Save & run
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className={cn("mb-6 grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3", panelClass)}>
        <div className="space-y-2">
          <Label className={fieldLabelClass}>Context</Label>
          <Select
            value={blueprint.settings.brandKitId ?? "none"}
            onValueChange={(value) => updateSettings({
              brandKitId: value === "none" ? null : value,
            })}
          >
            <SelectTrigger className={fieldControlClass}>
              <SelectValue placeholder="Brand kit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No brand context</SelectItem>
              {brandKits.map((kit) => (
                <SelectItem key={kit.id} value={kit.id}>
                  {kit.name}{kit.isDefault ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className={fieldLabelClass}>Description</Label>
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short description for the template gallery"
            className={fieldControlClass}
          />
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <Label className={fieldLabelClass}>Mode</Label>
          <ToggleGroup
            type="single"
            value={blueprint.settings.mode}
            onValueChange={(value) => {
              if (value) updateSettings({ mode: value as "product" | "custom" })
            }}
            className="grid h-10 w-full grid-cols-2 rounded-full bg-background/50 p-1 ring-1 ring-inset ring-border/40"
          >
            <ToggleGroupItem
              value="product"
              className="h-8 rounded-full border-0 px-3 text-sm shadow-none data-[state=off]:bg-transparent data-[state=off]:text-muted-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              Product
            </ToggleGroupItem>
            <ToggleGroupItem
              value="custom"
              className="h-8 rounded-full border-0 px-3 text-sm shadow-none data-[state=off]:bg-transparent data-[state=off]:text-muted-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              Custom
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="mb-5">
        <CharacterAssetPicker
          label="Default character (optional)"
          value={blueprint.settings.defaultCharacterAssetId && blueprint.settings.defaultCharacterPreviewUrl
            ? {
                assetId: blueprint.settings.defaultCharacterAssetId,
                previewUrl: blueprint.settings.defaultCharacterPreviewUrl,
              }
            : null}
          onChange={(selection) => updateSettings({
            defaultCharacterAssetId: selection?.assetId ?? null,
            defaultCharacterPreviewUrl: selection?.previewUrl ?? null,
          })}
        />
      </div>

      <div className="space-y-4">
        <SlideStructureRail
          blueprint={blueprint}
          selectedSlideId={selectedSlideId}
          onBlueprintChange={setBlueprint}
          onSelectSlide={setSelectedSlideId}
        />

        <TemplateToolbar
          aspectRatio={aspectRatio}
          onAspectRatioChange={setAspectRatio}
          blueprint={blueprint}
          onBlueprintChange={setBlueprint}
        />

        <AdvancedTextSettings blueprint={blueprint} onBlueprintChange={setBlueprint} />

        <SlideDetailPanel
          slide={selectedSlide}
          slideIndex={selectedSlideIndex}
          blueprint={blueprint}
          collections={collections}
          onSlideChange={updateSlide}
        />
      </div>
    </div>
  )
}
