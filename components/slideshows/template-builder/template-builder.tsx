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

type BrandKitOption = { id: string; name: string; isDefault?: boolean }

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
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href={backHref}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Template builder</p>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 h-11 max-w-md border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
              placeholder="Template name"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy !== null} onClick={() => void handleSave()}>
            {busy === "save" ? <CircleNotch className="mr-2 h-4 w-4 animate-spin" /> : <FloppyDisk className="mr-2 h-4 w-4" />}
            Save
          </Button>
          {onSaveAndRun ? (
            <Button disabled={busy !== null} onClick={() => void handleSaveAndRun()}>
              {busy === "run" ? <CircleNotch className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save & run
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mb-6 grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Context</Label>
            <Select
              value={blueprint.settings.brandKitId ?? "none"}
              onValueChange={(value) => updateSettings({
                brandKitId: value === "none" ? null : value,
              })}
            >
              <SelectTrigger><SelectValue placeholder="Brand kit" /></SelectTrigger>
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
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short description for the template gallery"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Mode</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={blueprint.settings.mode}
            onValueChange={(value) => {
              if (value) updateSettings({ mode: value as "product" | "custom" })
            }}
          >
            <ToggleGroupItem value="product">Product</ToggleGroupItem>
            <ToggleGroupItem value="custom">Custom</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="mb-4">
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
