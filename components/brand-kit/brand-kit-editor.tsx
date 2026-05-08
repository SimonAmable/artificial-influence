"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowUp,
  LinkSimple,
  PencilSimple,
  Plus,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { mapSuggestedColorsToTokens } from "@/lib/brand-kit/analyze-url-llm"
import {
  BRAND_ONBOARDING_SESSION_KEY,
  type BrandOnboardingClientPayload,
} from "@/lib/brand-kit/onboarding-schema"
import type { BrandColorToken, BrandKit, BrandReferenceMediaItem } from "@/lib/brand-kit/types"
import { BrandKitColors } from "@/components/brand-kit/brand-kit-colors"
import { BrandFontPicker } from "@/components/brand-kit/brand-font-picker"
import { cn } from "@/lib/utils"
import { invalidateCommandCache } from "@/lib/commands/cache"

/** Survives React Strict Mode double-mount: session → module once, single in-flight load applies it. */
let moduleOnboardingDraft: BrandOnboardingClientPayload | null = null

function takeModuleOnboardingDraftFromSession(): void {
  if (typeof window === "undefined") return
  if (moduleOnboardingDraft !== null) return
  const raw = sessionStorage.getItem(BRAND_ONBOARDING_SESSION_KEY)
  if (!raw) return
  try {
    moduleOnboardingDraft = JSON.parse(raw) as BrandOnboardingClientPayload
  } catch {
    moduleOnboardingDraft = null
  } finally {
    sessionStorage.removeItem(BRAND_ONBOARDING_SESSION_KEY)
  }
}

function clearModuleOnboardingDraft(): void {
  moduleOnboardingDraft = null
}

const ACCENT = "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
const CARD = "rounded-2xl border border-border bg-card p-4"
const PAGE_BG = "bg-background text-foreground"
const INNER = "bg-card"

function normalizeHex(raw: string): string {
  const s = raw.trim().replace(/^#/, "")
  if (s.length === 6 && /^[0-9A-Fa-f]{6}$/.test(s)) return `#${s.toUpperCase()}`
  return raw.startsWith("#") ? raw : `#${raw}`
}

function TagPills({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = React.useState("")
  const add = () => {
    const t = draft.trim()
    if (!t || values.includes(t)) return
    onChange([...values, t])
    setDraft("")
  }
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-transparent px-3 py-1 text-xs text-zinc-200"
          >
            {v}
            <button
              type="button"
              className="text-zinc-500 hover:text-white"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className="h-9 border-zinc-700 bg-zinc-950/50 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        <Button type="button" size="sm" variant="outline" className="shrink-0 border-zinc-700" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export type BrandKitEditorProps = {
  variant?: "page" | "dialog"
  className?: string
  onSaved?: () => void
  /** When set (e.g. from `/brand/[id]`), locks the editor to one kit and hides the kit switcher. */
  forcedKitId?: string | null
  backHref?: string
}

export function BrandKitEditor({
  variant = "page",
  className,
  onSaved,
  forcedKitId,
  backHref = "/chat",
}: BrandKitEditorProps) {
  const router = useRouter()
  const loadInProgressRef = React.useRef(false)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [notFound, setNotFound] = React.useState(false)
  const [kits, setKits] = React.useState<BrandKit[]>([])

  const [kitId, setKitId] = React.useState<string | null>(null)
  const [isNew, setIsNew] = React.useState(false)
  const [name, setName] = React.useState("My brand")
  const [isDefault, setIsDefault] = React.useState(true)
  const [websiteUrl, setWebsiteUrl] = React.useState("")
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null)
  const [fontFamily, setFontFamily] = React.useState("")
  const [colors, setColors] = React.useState<BrandColorToken[]>([])
  const [tagline, setTagline] = React.useState("")
  const [brandValues, setBrandValues] = React.useState<string[]>([])
  const [aestheticKeywords, setAestheticKeywords] = React.useState<string[]>([])
  const [toneTags, setToneTags] = React.useState<string[]>([])
  const [referenceMedia, setReferenceMedia] = React.useState<BrandReferenceMediaItem[]>([])
  const [freeformNotes, setFreeformNotes] = React.useState("")
  const [avoidWords, setAvoidWords] = React.useState<string[]>([])
  const [layoutNotes, setLayoutNotes] = React.useState<string | null>(null)
  const [audience, setAudience] = React.useState<string | null>(null)
  const [logoDarkUrl, setLogoDarkUrl] = React.useState<string | null>(null)
  const [iconUrl, setIconUrl] = React.useState<string | null>(null)
  const [iconDarkUrl, setIconDarkUrl] = React.useState<string | null>(null)
  const [monoFont, setMonoFont] = React.useState<string | undefined>(undefined)

  const applyKit = React.useCallback((k: BrandKit) => {
    setKitId(k.id)
    setIsNew(false)
    setName(k.name)
    setIsDefault(k.isDefault)
    setLogoUrl(k.logoUrl)
    setLogoDarkUrl(k.logoDarkUrl)
    setIconUrl(k.iconUrl)
    setIconDarkUrl(k.iconDarkUrl)
    setFontFamily(
      (k.fontFamily ?? k.typography?.bodyFont ?? k.typography?.headingFont ?? "").trim(),
    )
    setMonoFont(k.typography?.monoFont)
    setColors(k.colors?.length ? k.colors : [])
    setTagline(k.tagline ?? "")
    setWebsiteUrl((k.websiteUrl ?? "").trim())
    setFreeformNotes(k.notes ?? "")

    setBrandValues(k.brandValues ?? [])
    setAestheticKeywords(k.aestheticTags ?? [])
    setToneTags(k.toneTags ?? [])
    setReferenceMedia(k.referenceMedia ?? [])
    setAvoidWords(k.avoidWords ?? [])
    setLayoutNotes(k.layoutNotes)
    setAudience(k.audience)
  }, [])

  const resetEmptyForm = React.useCallback(() => {
    setIsNew(true)
    setKitId(null)
    setName("My brand")
    setWebsiteUrl("")
    setLogoUrl(null)
    setFontFamily("")
    setColors([])
    setTagline("")
    setBrandValues([])
    setAestheticKeywords([])
    setToneTags([])
    setReferenceMedia([])
    setFreeformNotes("")
    setAvoidWords([])
    setLayoutNotes(null)
    setAudience(null)
    setLogoDarkUrl(null)
    setIconUrl(null)
    setIconDarkUrl(null)
    setMonoFont(undefined)
  }, [])

  const applyOnboardingDraft = React.useCallback((payload: BrandOnboardingClientPayload) => {
    const { draft } = payload
    if (draft.suggestedName?.trim()) setName(draft.suggestedName.trim())
    if (draft.tagline?.trim()) setTagline(draft.tagline.trim())
    setBrandValues(draft.brandValues ?? [])
    setAestheticKeywords(draft.aestheticTags ?? [])
    setToneTags(draft.toneTags ?? [])
    if (draft.suggestedFontFamily?.trim()) setFontFamily(draft.suggestedFontFamily.trim())
    if (draft.suggestedMonoFont?.trim()) setMonoFont(draft.suggestedMonoFont.trim())
    setAvoidWords(draft.avoidWords ?? [])
    if (draft.audience?.trim()) setAudience(draft.audience.trim())
    if (draft.layoutNotes?.trim()) setLayoutNotes(draft.layoutNotes.trim())
    const noteParts: string[] = []
    if (draft.notes?.trim()) noteParts.push(draft.notes.trim())
    if (payload.themeColorHint) {
      noteParts.push(`Detected meta theme-color: ${payload.themeColorHint}`)
    }
    if (draft.warnings?.length) noteParts.push(`Warnings: ${draft.warnings.join("; ")}`)
    if (noteParts.length) setFreeformNotes(noteParts.join("\n\n"))
    if (draft.websiteUrl?.trim()) setWebsiteUrl(draft.websiteUrl.trim())
    if (draft.selectedLogoUrl) setLogoUrl(draft.selectedLogoUrl)
    const colorTokens = mapSuggestedColorsToTokens(draft.suggestedColors ?? [])
    if (colorTokens.length) setColors(colorTokens)

    const extractedImages = payload.referenceImages ?? []
    const extractedVideos = payload.referenceVideos ?? []
    if (extractedImages.length || extractedVideos.length) {
      const skipUrls = new Set<string>()
      if (draft.selectedLogoUrl) skipUrls.add(draft.selectedLogoUrl)
      const items: BrandReferenceMediaItem[] = [
        ...extractedImages
          .filter((u) => !skipUrls.has(u))
          .map((url) => ({ url, kind: "image" as const })),
        ...extractedVideos.map((url) => ({ url, kind: "video" as const })),
      ]
      if (items.length) setReferenceMedia(items)
    }
  }, [])

  const load = React.useCallback(async () => {
    if (forcedKitId) {
      takeModuleOnboardingDraftFromSession()
    }
    if (loadInProgressRef.current) return
    loadInProgressRef.current = true
    setLoading(true)
    setNotFound(false)
    try {
      if (forcedKitId) {
        const res = await fetch(`/api/brand-kits/${forcedKitId}`)
        if (res.status === 404) {
          setNotFound(true)
          clearModuleOnboardingDraft()
          return
        }
        if (res.status === 401) {
          setKits([])
          resetEmptyForm()
          clearModuleOnboardingDraft()
          return
        }
        if (!res.ok) throw new Error("Failed to load")
        const { kit } = (await res.json()) as { kit: BrandKit }
        applyKit(kit)
        const pending = moduleOnboardingDraft
        if (pending) {
          applyOnboardingDraft(pending)
          clearModuleOnboardingDraft()
          toast.success("Applied draft from your website")
        }
        const res2 = await fetch("/api/brand-kits")
        if (res2.ok) {
          const d2 = (await res2.json()) as { kits: BrandKit[] }
          setKits(d2.kits)
        }
        return
      }

      const res = await fetch("/api/brand-kits")
      if (res.status === 401) {
        setKits([])
        resetEmptyForm()
        return
      }
      if (!res.ok) throw new Error("Failed to load")
      const data = (await res.json()) as { kits: BrandKit[] }
      setKits(data.kits)
      if (data.kits.length === 0) {
        resetEmptyForm()
      } else {
        const def = data.kits.find((x) => x.isDefault) ?? data.kits[0]
        applyKit(def)
      }
    } catch (e) {
      console.error(e)
      toast.error("Could not load brand kit")
    } finally {
      loadInProgressRef.current = false
      setLoading(false)
    }
  }, [applyKit, applyOnboardingDraft, forcedKitId, resetEmptyForm])

  React.useEffect(() => {
    void load()
  }, [load])

  const selectKit = (id: string) => {
    if (id === "__new__") {
      void (async () => {
        try {
          const res = await fetch("/api/brand-kits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "My brand", isDefault: false }),
          })
          const json = (await res.json().catch(() => ({}))) as { error?: string; kit?: BrandKit }
          if (!res.ok) throw new Error(json.error || "Could not create kit")
          if (json.kit?.id) {
            invalidateCommandCache()
            router.push(`/brand/${json.kit.id}`)
          }
        } catch (e) {
          console.error(e)
          toast.error(e instanceof Error ? e.message : "Could not create kit")
        }
      })()
      return
    }
    const k = kits.find((x) => x.id === id)
    if (k) applyKit(k)
  }

  const save = async () => {
    if (!name.trim()) {
      toast.error("Add a business name")
      return
    }
    setSaving(true)
    try {
      const typography = {
        bodyFont: fontFamily.trim() || undefined,
        headingFont: fontFamily.trim() || undefined,
        monoFont,
        notes: undefined,
      }
      const body = {
        name: name.trim(),
        isDefault,
        websiteUrl: websiteUrl.trim() || null,
        fontFamily: fontFamily.trim() || null,
        referenceMedia,
        brandValues,
        aestheticTags: aestheticKeywords,
        toneTags,
        notes: freeformNotes.trim() || null,
        logoUrl,
        logoDarkUrl,
        iconUrl,
        iconDarkUrl,
        colors: colors.map((c) => ({ ...c, hex: normalizeHex(c.hex) })),
        typography,
        tagline: tagline.trim() || null,
        avoidWords,
        layoutNotes,
        audience,
      }

      if (isNew || !kitId) {
        const res = await fetch("/api/brand-kits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = (await res.json().catch(() => ({}))) as { error?: string; kit?: BrandKit }
        if (!res.ok) {
          throw new Error(json.error || "Save failed")
        }
        toast.success("Saved")
      } else {
        const res = await fetch(`/api/brand-kits/${kitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error || "Save failed")
        }
        toast.success("Looks good. Saved.")
      }
      invalidateCommandCache()
      await load()
      onSaved?.()
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const deleteCurrentKit = async () => {
    if (!kitId) return
    const ok = window.confirm(`Delete "${name.trim() || "this brand kit"}"? This cannot be undone.`)
    if (!ok) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/brand-kits/${kitId}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Delete failed")
      }
      invalidateCommandCache()
      toast.success("Brand kit deleted")
      router.push("/brand")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  const uploadLogo = async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const up = await uploadFileToSupabase(file, "brand-kit")
      if (up) {
        setLogoUrl(up.url)
        toast.success("Logo uploaded")
      }
    }
    input.click()
  }

  const uploadReferenceMedia = async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*,video/*"
    input.multiple = true
    input.onchange = async () => {
      const files = input.files ? Array.from(input.files) : []
      for (const file of files) {
        const up = await uploadFileToSupabase(file, "brand-kit")
        if (up) {
          const kind: BrandReferenceMediaItem["kind"] = file.type.startsWith("video/") ? "video" : "image"
          setReferenceMedia((prev) => [...prev, { url: up.url, kind }])
        }
      }
      if (files.length) toast.success(`Added ${files.length} file(s)`)
    }
    input.click()
  }

  const removeMediaAt = (i: number) => {
    setReferenceMedia((prev) => prev.filter((_, j) => j !== i))
  }

  if (loading) {
    return (
      <div className={cn(PAGE_BG, "flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground", className)}>
        Loading…
      </div>
    )
  }

  if (notFound && forcedKitId) {
    return (
      <div className={cn(PAGE_BG, "flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center", className)}>
        <p className="text-muted-foreground">This brand kit could not be found.</p>
        <Button type="button" variant="outline" asChild className="rounded-full border-border">
          <Link href="/brand">Back to brand kits</Link>
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        variant === "page" ? cn(PAGE_BG, "min-h-screen") : "text-foreground",
        className,
      )}
    >
      {variant === "page" ? (
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <Button
            type="button"
            variant="outline"
            asChild
            className="w-fit rounded-full border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="flex-1 text-center sm:order-2">
            <h1 className="font-serif text-2xl italic tracking-tight text-foreground md:text-3xl">Your Business DNA</h1>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              Here is a snapshot of your business that we&apos;ll use to create campaigns and keep AI on-brand. Edit
              anytime.
            </p>
          </div>
          <div className="hidden w-[120px] sm:block sm:order-3" aria-hidden />
        </div>
      ) : (
        <div className="mb-4 text-center">
          <h2 className="font-serif text-xl italic text-foreground">Your Business DNA</h2>
          <p className="mt-1 text-xs text-muted-foreground">Snapshot used for campaigns and the Creative Agent.</p>
        </div>
      )}

      {forcedKitId ? (
        <label className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-zinc-600"
          />
          Use as default for Creative Agent
        </label>
      ) : kits.length > 1 || isNew ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select value={isNew ? "__new__" : kitId ?? "__new__"} onValueChange={selectKit}>
            <SelectTrigger className="w-[220px] border-zinc-700 bg-zinc-950/50 text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kits.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.name}
                  {k.isDefault ? " (default)" : ""}
                </SelectItem>
              ))}
              <SelectItem value="__new__">+ New kit</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Default for AI
          </label>
        </div>
      ) : (
        <label className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-zinc-600"
          />
          Use as default for Creative Agent
        </label>
      )}

      <div className={cn("rounded-3xl border border-border p-4 shadow-2xl md:p-6", INNER)}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8">
          {/* Left column */}
          <div className="space-y-4">
            {/* Name + URL */}
            <div className={cn(CARD, "relative")}>
              <div className="absolute right-3 top-3 text-zinc-600">
                <PencilSimple className="h-4 w-4" weight="bold" />
              </div>
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Name</p>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 border-0 bg-transparent px-2 py-1 text-2xl font-bold text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                placeholder="Business name"
              />
              <p className="mt-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Website URL</p>
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
                <LinkSimple className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://…"
                  className="min-w-0 flex-1 border-0 bg-transparent py-1 pl-2 pr-2 text-sm text-primary/90 placeholder:text-muted-foreground focus-visible:ring-0"
                  autoComplete="url"
                />
              </div>
            </div>

            {/* Logo + Fonts */}
            <div className="grid grid-cols-2 gap-3">
              <div className={cn(CARD, "flex aspect-square flex-col items-stretch justify-stretch p-2")}>
                <button
                  type="button"
                  onClick={() => void uploadLogo()}
                  aria-label={logoUrl ? "Replace logo" : "Upload logo"}
                  className={cn(
                    "group relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500",
                    logoUrl
                      ? "items-start justify-start border-2 border-solid border-zinc-700 bg-zinc-950/30"
                      : "items-center justify-center gap-2 border-2 border-dashed border-zinc-600 bg-zinc-950/40 px-2 py-4 hover:border-zinc-500 hover:bg-zinc-950/55",
                  )}
                >
                  <span className="pointer-events-none absolute left-3 top-3 z-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    Logo
                  </span>
                  {logoUrl ? (
                    <>
                      <img
                        src={logoUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain object-top-left p-2"
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/45">
                        <span className="rounded-full bg-zinc-900/95 px-3 py-1.5 text-xs font-medium text-zinc-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                          Replace logo
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <UploadSimple className="h-9 w-9 shrink-0 text-zinc-400" weight="regular" aria-hidden />
                      <span className="text-sm font-medium text-zinc-300">Upload logo</span>
                      <span className="text-[10px] text-zinc-600">PNG, JPG, or SVG</span>
                    </>
                  )}
                </button>
              </div>
              <div className={cn(CARD, "flex min-h-0 flex-col")}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Fonts</p>
                <p
                  className="mt-2 text-5xl leading-none text-white"
                  style={
                    fontFamily.trim()
                      ? { fontFamily: `"${fontFamily.trim()}", system-ui, sans-serif` }
                      : undefined
                  }
                >
                  Aa
                </p>
                <div className="mt-3 min-w-0">
                  <BrandFontPicker
                    value={fontFamily.trim() || undefined}
                    onChange={(f) => setFontFamily(f)}
                  />
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className={CARD}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Colors</p>
              <div className="mt-4">
                <BrandKitColors colors={colors} onChange={setColors} />
              </div>
            </div>

            {/* Tagline + Brand values */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={CARD}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Tagline</p>
                <Textarea
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Your hero line…"
                  rows={4}
                  className="mt-2 resize-none border-0 bg-transparent px-2 py-1.5 font-serif text-base italic leading-relaxed text-primary/90 placeholder:text-zinc-600 focus-visible:ring-0"
                />
              </div>
              <div className={CARD}>
                <TagPills
                  label="Brand values"
                  values={brandValues}
                  onChange={setBrandValues}
                  placeholder="Add a value, Enter"
                />
              </div>
            </div>

            {/* Aesthetic + Tone */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={CARD}>
                <TagPills
                  label="Brand aesthetic"
                  values={aestheticKeywords}
                  onChange={setAestheticKeywords}
                  placeholder="e.g. Dark Mode Minimalism"
                />
              </div>
              <div className={CARD}>
                <TagPills
                  label="Brand tone of voice"
                  values={toneTags}
                  onChange={setToneTags}
                  placeholder="e.g. Modern"
                />
              </div>
            </div>

            <div className={CARD}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Extra notes (optional)</p>
              <Textarea
                value={freeformNotes}
                onChange={(e) => setFreeformNotes(e.target.value)}
                rows={2}
                placeholder="Anything else models should know…"
                className="mt-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Right column: reference images & videos */}
          <div className={cn(CARD, "relative flex min-h-[320px] flex-col lg:min-h-[480px]")}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Images &amp; videos
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => void uploadReferenceMedia()}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-600 bg-zinc-950/40 px-1 text-center text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-300"
              >
                <ArrowUp className="h-6 w-6 shrink-0" />
                Upload media
              </button>
              {referenceMedia.map((item, i) => (
                <div
                  key={item.url + i}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-800 bg-black"
                >
                  {item.kind === "video" ? (
                    <video
                      src={item.url}
                      className="h-full w-full object-cover"
                      controls
                      muted
                      playsInline
                    />
                  ) : (
                    // Reference media comes from arbitrary external brand CDNs, so we render
                    // with a native `<img>` instead of `next/image` (which requires whitelisting
                    // each hostname under `images.remotePatterns`).
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMediaAt(i)}
                    className="absolute right-1 top-1 z-10 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer bar */}
        <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Next we&apos;ll use your Business DNA to generate on-brand content and campaigns.
          </p>
          <div className="flex items-center gap-2 self-end">
            {!isNew && kitId ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving || deleting}
                onClick={() => void deleteCurrentKit()}
                className="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={saving || deleting}
              onClick={() => void save()}
              className={cn("rounded-full px-8 py-6 text-base font-semibold", ACCENT)}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
