"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CircleNotch, Sparkle } from "@phosphor-icons/react"
import { toast } from "sonner"
import type {
  ComposerAssetAttachment,
  ComposerAttachment,
  ComposerUploadAttachment,
} from "@/components/chat/composer/types"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import {
  TemplateInputField,
  type TemplateFieldValue,
} from "@/components/templates/template-input-field"
import { Button } from "@/components/ui/button"
import type { AssetCategory, AssetType } from "@/lib/assets/types"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import type { AttachedRef } from "@/lib/commands/types"
import { setPendingTemplateHandoff } from "@/lib/templates/handoff"
import type { Template } from "@/lib/templates/types"
import { getDefaultInputValue, isMediaInputKind } from "@/lib/templates/validation"
import { cn } from "@/lib/utils"

type AssetModalTarget =
  | { mode: "prompt"; inputId: string }
  | { mode: "media"; inputId: string; inputKind: "image" | "video" | "audio" }

function getAssetModalConfigForTarget(target: AssetModalTarget): {
  presetCategory?: AssetCategory
  allowedAssetTypes?: AssetType[]
} {
  if (target.mode === "prompt") {
    return { presetCategory: "character", allowedAssetTypes: ["image"] }
  }

  switch (target.inputKind) {
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

interface TemplateRunFormProps {
  template: Template
  disabled?: boolean
  className?: string
  compactDesktop?: boolean
}

function createClientId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function assetPickToPromptAttachment(pick: AssetSelectionPick): ComposerAssetAttachment {
  const id = createClientId()
  const ref: AttachedRef = {
    id,
    label: pick.title?.trim() || "Reference image",
    category: "asset",
    assetType: "image",
    assetUrl: pick.url,
    previewUrl: pick.previewUrl ?? pick.url,
    serialized: `Reference (image) "${pick.title?.trim() || "Reference image"}": ${pick.url}`,
    chipId: id,
    mentionToken: "",
  }

  return {
    assetType: "image",
    id,
    ref,
    source: "asset",
    title: pick.title?.trim() || "Reference image",
    url: pick.url,
  }
}

function buildInitialValues(template: Template): Record<string, TemplateFieldValue> {
  const values: Record<string, TemplateFieldValue> = {}
  for (const input of template.inputs) {
    if (isMediaInputKind(input.kind)) {
      values[input.id] = null
    } else {
      values[input.id] = getDefaultInputValue(input)
    }
  }
  return values
}

export function TemplateRunForm({
  template,
  disabled = false,
  className,
  compactDesktop = false,
}: TemplateRunFormProps) {
  const router = useRouter()
  const [values, setValues] = React.useState<Record<string, TemplateFieldValue>>(() =>
    buildInitialValues(template),
  )
  const [previewUrls, setPreviewUrls] = React.useState<Record<string, string | null>>({})
  const [mediaLabelsByInputId, setMediaLabelsByInputId] = React.useState<Record<string, string>>({})
  const [promptAttachmentsByInputId, setPromptAttachmentsByInputId] = React.useState<
    Record<string, ComposerAttachment[]>
  >({})
  const [assetModalTarget, setAssetModalTarget] = React.useState<AssetModalTarget | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach((url) => {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url)
      })
    }
  }, [previewUrls])

  const setFieldValue = (id: string, next: TemplateFieldValue) => {
    setValues((current) => ({ ...current, [id]: next }))

    if (next instanceof File) {
      setMediaLabelsByInputId((current) => {
        const updated = { ...current }
        delete updated[id]
        return updated
      })

      if (
        next.type.startsWith("image/") ||
        next.type.startsWith("video/") ||
        next.type.startsWith("audio/")
      ) {
        setPreviewUrls((current) => {
          const previous = current[id]
          if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous)
          return { ...current, [id]: URL.createObjectURL(next) }
        })
        return
      }
    }

    if (typeof next === "string" && next.startsWith("http")) {
      setPreviewUrls((current) => {
        const previous = current[id]
        if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous)
        return { ...current, [id]: next }
      })
      return
    }

    setMediaLabelsByInputId((current) => {
      const updated = { ...current }
      delete updated[id]
      return updated
    })
    setPreviewUrls((current) => {
      const previous = current[id]
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous)
      return { ...current, [id]: null }
    })
  }

  const handleSubmit = async () => {
    if (disabled) return

    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {}
      const promptImageUrlsByInputId: Record<string, string[]> = {}

      for (const input of template.inputs) {
        const raw = values[input.id]

        if (isMediaInputKind(input.kind)) {
          if (raw instanceof File) {
            const uploaded = await uploadFileToSupabase(raw, "template-inputs")
            if (!uploaded) {
              throw new Error(`Failed to upload ${input.label}`)
            }
            payload[input.id] = uploaded.url
          } else if (typeof raw === "string" && raw.startsWith("http")) {
            payload[input.id] = raw
          } else if (input.required) {
            throw new Error(`${input.label} is required`)
          }
          continue
        }

        payload[input.id] = raw
      }

      for (const [inputId, attachments] of Object.entries(promptAttachmentsByInputId)) {
        if (!attachments.length) continue

        const uploadedUrls: string[] = []
        for (const attachment of attachments) {
          if (attachment.source === "asset") {
            uploadedUrls.push(attachment.url)
            continue
          }

          const uploaded = await uploadFileToSupabase(attachment.file, "template-prompt-images")
          if (!uploaded) {
            throw new Error(`Failed to upload a reference image for ${inputId}`)
          }
          uploadedUrls.push(uploaded.url)
        }

        if (uploadedUrls.length > 0) {
          promptImageUrlsByInputId[inputId] = uploadedUrls
        }
      }

      const response = await fetch(`/api/templates/run/${template.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: payload,
          promptImageUrlsByInputId,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to run template")
      }

      setPendingTemplateHandoff({
        threadId: data.threadId,
        templateSlug: data.templateSlug,
        openingMessage: data.openingMessage,
      })

      router.push(`/chat/${data.threadId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start generation")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePromptAttachmentFilesSelected = React.useCallback((inputId: string, files: File[]) => {
    const nextFiles = files.filter((file) => file.type.startsWith("image/"))
    if (nextFiles.length !== files.length) {
      toast.error("Only image files can be attached to template prompts")
    }
    if (nextFiles.length === 0) return

    const nextAttachments: ComposerUploadAttachment[] = nextFiles.map((file) => ({
      file,
      id: createClientId(),
      isUploading: false,
      source: "upload",
    }))

    setPromptAttachmentsByInputId((current) => ({
      ...current,
      [inputId]: [...(current[inputId] ?? []), ...nextAttachments],
    }))
  }, [])

  const handleAssetSelect = React.useCallback(
    (pick: AssetSelectionPick) => {
      if (!assetModalTarget) return

      if (assetModalTarget.mode === "prompt") {
        if (pick.assetType !== "image") {
          toast.error("Only image assets can be attached to template prompts")
          return
        }

        setPromptAttachmentsByInputId((current) => ({
          ...current,
          [assetModalTarget.inputId]: [
            ...(current[assetModalTarget.inputId] ?? []),
            assetPickToPromptAttachment(pick),
          ],
        }))
        setAssetModalTarget(null)
        return
      }

      const expectedType = assetModalTarget.inputKind
      if (pick.assetType !== expectedType) {
        toast.error(`Selected asset must be a ${expectedType}`)
        return
      }

      setFieldValue(assetModalTarget.inputId, pick.url)
      setMediaLabelsByInputId((current) => ({
        ...current,
        [assetModalTarget.inputId]: pick.title?.trim() || `${expectedType} asset`,
      }))
      setAssetModalTarget(null)
    },
    [assetModalTarget],
  )

  const handleRemovePromptAttachment = React.useCallback((inputId: string, attachmentId: string) => {
    setPromptAttachmentsByInputId((current) => {
      const next = (current[inputId] ?? []).filter((attachment) => attachment.id !== attachmentId)
      if (next.length === 0) {
        const updated = { ...current }
        delete updated[inputId]
        return updated
      }

      return {
        ...current,
        [inputId]: next,
      }
    })
  }, [])

  return (
    <div className={cn("space-y-6", compactDesktop && "lg:space-y-4", className)}>
      <div className={cn("space-y-5", compactDesktop && "lg:space-y-4")}>
        {template.inputs.map((input) => {
          const supportsPromptAttachments = input.kind === "text" && input.multiline
          const isMediaInput =
            input.kind === "image" || input.kind === "video" || input.kind === "audio"

          return (
            <TemplateInputField
              key={input.id}
              input={input}
              value={values[input.id] ?? null}
              previewUrl={previewUrls[input.id] ?? null}
              mediaLabel={mediaLabelsByInputId[input.id] ?? null}
              disabled={disabled || isSubmitting}
              compactDesktop={compactDesktop}
              onChange={(next) => setFieldValue(input.id, next)}
              promptAttachments={promptAttachmentsByInputId[input.id] ?? []}
              onPromptAttachmentFilesSelected={
                disabled || isSubmitting || !supportsPromptAttachments
                  ? undefined
                  : (files) => handlePromptAttachmentFilesSelected(input.id, files)
              }
              onOpenPromptAssetPicker={
                disabled || isSubmitting || !supportsPromptAttachments
                  ? undefined
                  : () => setAssetModalTarget({ mode: "prompt", inputId: input.id })
              }
              onOpenMediaAssetPicker={
                disabled || isSubmitting || !isMediaInput
                  ? undefined
                  : () =>
                      setAssetModalTarget({
                        mode: "media",
                        inputId: input.id,
                        inputKind: input.kind,
                      })
              }
              onRemovePromptAttachment={(attachment) =>
                handleRemovePromptAttachment(input.id, attachment.id)
              }
            />
          )
        })}
      </div>

      {template.output_kind === "video" ? (
        <p className="text-center text-xs text-muted-foreground">
          Generation typically takes 2-5 minutes for video templates.
        </p>
      ) : null}

      {!disabled ? (
        <Button
          className="h-12 w-full rounded-full text-base"
          disabled={isSubmitting}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting ? (
            <>
              <CircleNotch className="mr-2 size-4 animate-spin" weight="bold" />
              Starting...
            </>
          ) : (
            <>
              <span>Generate</span>
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-background/16 px-2.5 py-1 text-xs font-medium text-primary-foreground/90 ring-1 ring-white/15">
                <Sparkle className="size-3.5" weight="fill" />
                {template.credits_cost}
              </span>
            </>
          )}
        </Button>
      ) : null}

      <AssetSelectionModal
        open={assetModalTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAssetModalTarget(null)
          }
        }}
        onSelect={handleAssetSelect}
        {...(assetModalTarget ? getAssetModalConfigForTarget(assetModalTarget) : {})}
      />
    </div>
  )
}
