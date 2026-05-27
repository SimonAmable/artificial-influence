"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CircleNotch } from "@phosphor-icons/react"
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
import type { Template } from "@/lib/templates/types"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import type { AttachedRef } from "@/lib/commands/types"
import { setPendingTemplateHandoff } from "@/lib/templates/handoff"
import { getDefaultInputValue, isMediaInputKind } from "@/lib/templates/validation"
import {
  TemplateInputField,
  type TemplateFieldValue,
} from "@/components/templates/template-input-field"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TemplateRunFormProps {
  template: Template
  disabled?: boolean
  className?: string
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
}: TemplateRunFormProps) {
  const router = useRouter()
  const [values, setValues] = React.useState<Record<string, TemplateFieldValue>>(() =>
    buildInitialValues(template),
  )
  const [previewUrls, setPreviewUrls] = React.useState<Record<string, string | null>>({})
  const [promptAttachmentsByInputId, setPromptAttachmentsByInputId] = React.useState<
    Record<string, ComposerAttachment[]>
  >({})
  const [assetModalTargetInputId, setAssetModalTargetInputId] = React.useState<string | null>(null)
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

    if (next instanceof File && next.type.startsWith("image/")) {
      setPreviewUrls((current) => {
        const previous = current[id]
        if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous)
        return { ...current, [id]: URL.createObjectURL(next) }
      })
      return
    }

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

  const handlePromptAssetSelect = React.useCallback((pick: AssetSelectionPick) => {
    if (!assetModalTargetInputId) return

    if (pick.assetType !== "image") {
      toast.error("Only image assets can be attached to template prompts")
      return
    }

    setPromptAttachmentsByInputId((current) => ({
      ...current,
      [assetModalTargetInputId]: [
        ...(current[assetModalTargetInputId] ?? []),
        assetPickToPromptAttachment(pick),
      ],
    }))
    setAssetModalTargetInputId(null)
  }, [assetModalTargetInputId])

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
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary" className="text-xs font-normal">
          Cost: {template.credits_cost} credits
        </Badge>
      </div>

      <div className="space-y-5">
        {template.inputs.map((input) => {
          const supportsPromptAttachments = input.kind === "text" && input.multiline

          return (
            <TemplateInputField
              key={input.id}
              input={input}
              value={values[input.id] ?? null}
              previewUrl={previewUrls[input.id] ?? null}
              disabled={disabled || isSubmitting}
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
                  : () => setAssetModalTargetInputId(input.id)
              }
              onRemovePromptAttachment={(attachment) =>
                handleRemovePromptAttachment(input.id, attachment.id)
              }
            />
          )
        })}
      </div>

      {template.output_kind === "video" ? (
        <p className="text-xs text-muted-foreground text-center">
          Generation typically takes 2–5 minutes for video templates.
        </p>
      ) : null}

      {!disabled ? (
        <Button
          className="w-full rounded-full h-12 text-base"
          disabled={isSubmitting}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting ? (
            <>
              <CircleNotch className="mr-2 size-4 animate-spin" weight="bold" />
              Starting…
            </>
          ) : (
            "Generate →"
          )}
        </Button>
      ) : null}

      <AssetSelectionModal
        open={assetModalTargetInputId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAssetModalTargetInputId(null)
          }
        }}
        onSelect={handlePromptAssetSelect}
      />
    </div>
  )
}
