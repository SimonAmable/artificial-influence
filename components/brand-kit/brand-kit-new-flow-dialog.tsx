"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Circle, LinkSimple, Sparkle } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  BRAND_ONBOARDING_SESSION_KEY,
  type BrandOnboardingClientPayload,
} from "@/lib/brand-kit/onboarding-schema"
import { cn } from "@/lib/utils"

type Step = "choose" | "url"

/** Shown in rotation while `/api/brand-kit/analyze-url` is in flight. */
const ANALYSIS_STATUS_MESSAGES = [
  "Extracting logo candidates…",
  "Scanning colors & typography…",
  "Inferring tone and brand voice…",
  "Mapping values and audience…",
  "Finalizing your Business DNA draft…",
] as const

async function createBlankKit(): Promise<string> {
  const res = await fetch("/api/brand-kits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "My brand", isDefault: false }),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string; kit?: { id: string } }
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : "Could not create kit")
  }
  if (!json.kit?.id) throw new Error("Could not create kit")
  return json.kit.id
}

export type BrandKitNewFlowDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BrandKitNewFlowDialog({ open, onOpenChange }: BrandKitNewFlowDialogProps) {
  const router = useRouter()
  const [step, setStep] = React.useState<Step>("choose")
  const [url, setUrl] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [activeUrl, setActiveUrl] = React.useState<string | null>(null)
  const [creatingManual, setCreatingManual] = React.useState(false)
  const [analysisStatusIndex, setAnalysisStatusIndex] = React.useState(0)

  React.useEffect(() => {
    if (!open) {
      setStep("choose")
      setUrl("")
      setBusy(false)
      setActiveUrl(null)
      setCreatingManual(false)
      setAnalysisStatusIndex(0)
    }
  }, [open])

  React.useEffect(() => {
    if (!busy) {
      setAnalysisStatusIndex(0)
      return
    }
    const id = window.setInterval(() => {
      setAnalysisStatusIndex((i) => (i + 1) % ANALYSIS_STATUS_MESSAGES.length)
    }, 2400)
    return () => window.clearInterval(id)
  }, [busy])

  const goManual = async () => {
    setCreatingManual(true)
    try {
      const id = await createBlankKit()
      onOpenChange(false)
      router.push(`/brand/${id}`)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Could not create kit")
    } finally {
      setCreatingManual(false)
    }
  }

  const submitUrl = async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      toast.error("Enter a website URL")
      return
    }
    setBusy(true)
    setActiveUrl(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    try {
      const res = await fetch("/api/brand-kit/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Analysis failed")
      }
      const payload = data as BrandOnboardingClientPayload
      sessionStorage.setItem(BRAND_ONBOARDING_SESSION_KEY, JSON.stringify(payload))
      const id = await createBlankKit()
      onOpenChange(false)
      router.push(`/brand/${id}`)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Could not analyze URL")
    } finally {
      setBusy(false)
      setActiveUrl(null)
    }
  }

  const displayUrl =
    busy && activeUrl
      ? activeUrl
      : url.trim()
        ? /^https?:\/\//i.test(url.trim())
          ? url.trim()
          : `https://${url.trim()}`
        : "https://…"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[92vh] overflow-y-auto border-border bg-background p-6 text-foreground sm:max-w-lg",
        )}
      >
        {step === "choose" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl italic text-foreground">Create a brand kit</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Start from scratch or let us draft your Business DNA from a website.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                disabled={creatingManual}
                onClick={() => void goManual()}
                className="h-auto min-h-24 flex-col gap-1 rounded-2xl border-border bg-card py-4 text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <span className="text-sm font-semibold">Start from scratch</span>
                <span className="text-xs font-normal text-muted-foreground">Edit fields manually</span>
              </Button>
              <Button
                type="button"
                disabled={creatingManual}
                onClick={() => setStep("url")}
                className="h-auto min-h-24 flex-col gap-1 rounded-2xl bg-primary py-4 text-primary-foreground hover:bg-primary/90"
              >
                <span className="text-sm font-semibold">Analyze a website</span>
                <span className="text-xs font-normal text-primary-foreground/80">URL → draft DNA</span>
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <Button
                type="button"
                variant="ghost"
                className="mb-2 -ml-2 w-fit px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setStep("choose")}
              >
                ← Back
              </Button>
              <DialogTitle className="font-serif text-xl italic text-foreground">Analyze a website</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                We fetch your public page, then use AI to draft name, logo picks, colors, fonts, and tone into a new kit.
                You can edit everything before saving.
              </DialogDescription>
            </DialogHeader>

            <div
              className={cn(
                "relative mt-4 overflow-hidden rounded-3xl border border-border bg-muted/50 px-5 py-8 ring-1 ring-primary/20",
                "before:pointer-events-none before:absolute before:inset-y-0 before:right-0 before:w-1/2 before:bg-linear-to-l before:from-primary/15 before:to-transparent",
              )}
            >
              {busy ? (
                <h2 className="text-center font-serif text-lg italic leading-tight tracking-tight text-foreground">
                  Generating your Business DNA
                </h2>
              ) : null}

              <div className="mt-6 space-y-3">
                {busy ? (
                  <div
                    className={cn(
                      "inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm text-primary",
                    )}
                    aria-live="polite"
                  >
                    <Sparkle
                      className="h-4 w-4 shrink-0 animate-pulse text-primary"
                      weight="fill"
                      aria-hidden
                    />
                    <span key={analysisStatusIndex} className="text-center">
                      {ANALYSIS_STATUS_MESSAGES[analysisStatusIndex]}
                    </span>
                  </div>
                ) : (
                  <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                    <Sparkle className="h-4 w-4 shrink-0 text-primary/70" weight="fill" aria-hidden />
                    Add your URL below (public pages only).
                  </p>
                )}

                {busy ? (
                  <div className="flex w-full items-center gap-2 rounded-full border border-border bg-muted/70 px-4 py-2.5 text-sm text-primary/90">
                    <LinkSimple className="h-4 w-4 shrink-0 text-primary/80" />
                    <span className="min-w-0 truncate font-mono text-xs">{displayUrl}</span>
                  </div>
                ) : null}
              </div>

              {!busy ? (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void submitUrl()
                    }}
                    placeholder="yoursite.com"
                    className="h-11 flex-1 rounded-full border-input bg-background text-sm text-foreground placeholder:text-muted-foreground"
                    autoComplete="url"
                  />
                  <Button
                    type="button"
                    onClick={() => void submitUrl()}
                    className="h-11 shrink-0 rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90"
                  >
                    Analyze
                  </Button>
                </div>
              ) : null}

              <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-primary/70">
                <Circle className="h-3 w-3 shrink-0 text-primary/70" weight="regular" aria-hidden />
                {busy
                  ? "Hang tight: status above updates as we work"
                  : "~30s for most pages"}
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
