"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CircleNotch, Sparkle } from "@phosphor-icons/react"
import { toast } from "sonner"
import { setPendingTemplateEditorDraft } from "@/lib/templates/editor-draft-handoff"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

export function TemplateCreateDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<"chooser" | "ai">("chooser")
  const [instruction, setInstruction] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) return
    setStep("chooser")
    setInstruction("")
    setIsSubmitting(false)
  }, [open])

  const handleManual = () => {
    setOpen(false)
    router.push("/templates/new")
  }

  const handleAiCreate = async () => {
    if (!instruction.trim()) {
      toast.error("Describe the template you want to create")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/templates/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          instruction: instruction.trim(),
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const err =
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error ?? "Failed to create template draft")
        throw new Error(err)
      }

      setPendingTemplateEditorDraft(data.draft)
      toast.success(
        typeof data.summary === "string" && data.summary.trim()
          ? data.summary.trim()
          : "AI created a template draft.",
      )
      setOpen(false)
      router.push("/templates/new")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create template draft")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button className="rounded-full px-5" onClick={() => setOpen(true)}>
        Create template
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          {step === "chooser" ? (
            <>
              <DialogHeader>
                <DialogTitle>Create a template</DialogTitle>
                <DialogDescription>
                  Start with AI or build the template manually.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="rounded-2xl border bg-muted/20 p-5 text-left transition hover:border-amber-500/40 hover:bg-amber-500/5"
                  onClick={() => setStep("ai")}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkle className="size-4 text-amber-500" weight="fill" />
                    Ask AI
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Describe the workflow and let AI build the first template draft.
                  </p>
                </button>

                <button
                  type="button"
                  className="rounded-2xl border bg-muted/20 p-5 text-left transition hover:border-border/80 hover:bg-muted/40"
                  onClick={handleManual}
                >
                  <div className="text-sm font-medium">Manual</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Open the template editor and build everything yourself.
                  </p>
                </button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Ask AI to create a template</DialogTitle>
                <DialogDescription>
                  Describe the input fields, the output you want, and any style or format requirements.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <Textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={7}
                  disabled={isSubmitting}
                  placeholder="Create a template that turns one selfie into a luxury perfume ad video. Add a text field for the product name and an aspect ratio option."
                />
                <p className="text-xs text-muted-foreground">
                  AI will generate the first draft, then you can keep editing it manually before saving.
                </p>
              </div>

              <DialogFooter className="sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => setStep("chooser")}
                >
                  Back
                </Button>
                <Button type="button" disabled={isSubmitting} onClick={() => void handleAiCreate()}>
                  {isSubmitting ? (
                    <>
                      <CircleNotch className="mr-2 size-4 animate-spin" weight="bold" />
                      Creating draft...
                    </>
                  ) : (
                    <>
                      <Sparkle className="mr-2 size-4" weight="fill" />
                      Create With AI
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
