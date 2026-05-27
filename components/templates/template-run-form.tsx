"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CircleNotch } from "@phosphor-icons/react"
import { toast } from "sonner"
import type { Template } from "@/lib/templates/types"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
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
    }
  }

  const handleSubmit = async () => {
    if (disabled) return

    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {}

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

      const response = await fetch(`/api/templates/run/${template.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payload }),
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

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary" className="text-xs font-normal">
          Cost: {template.credits_cost} credits
        </Badge>
      </div>

      <div className="space-y-5">
        {template.inputs.map((input) => (
          <TemplateInputField
            key={input.id}
            input={input}
            value={values[input.id] ?? null}
            previewUrl={previewUrls[input.id] ?? null}
            disabled={disabled || isSubmitting}
            onChange={(next) => setFieldValue(input.id, next)}
          />
        ))}
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
    </div>
  )
}
