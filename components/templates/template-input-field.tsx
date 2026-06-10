"use client"

import * as React from "react"
import {
  FilePlus,
  FolderOpen,
  Image as ImageIcon,
  Plus,
  UploadSimple,
  X,
} from "@phosphor-icons/react"
import {
  ComposerAttachmentPreviews,
} from "@/components/chat/composer/attachments"
import type { ComposerAttachment } from "@/components/chat/composer/types"
import type { TemplateInput } from "@/lib/templates/types"
import { ASPECT_RATIO_PRESETS } from "@/lib/templates/input-utils"
import { getDefaultInputValue } from "@/lib/templates/validation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export type TemplateFieldValue = string | number | boolean | File | null

interface TemplateInputFieldProps {
  input: TemplateInput
  value: TemplateFieldValue
  onChange: (value: TemplateFieldValue) => void
  disabled?: boolean
  compactDesktop?: boolean
  previewUrl?: string | null
  mediaLabel?: string | null
  promptAttachments?: ComposerAttachment[]
  onOpenPromptAssetPicker?: () => void
  onOpenMediaAssetPicker?: () => void
  onPromptAttachmentFilesSelected?: (files: File[]) => void
  onRemovePromptAttachment?: (attachment: ComposerAttachment) => void
}

function useFileDragDrop(onFiles: (files: File[]) => void, enabled = true) {
  const [isDragging, setIsDragging] = React.useState(false)
  const dragCounter = React.useRef(0)

  const handleDrop = React.useCallback(
    (event: React.DragEvent) => {
      if (!enabled) return
      event.preventDefault()
      event.stopPropagation()
      dragCounter.current = 0
      setIsDragging(false)
      const files = Array.from(event.dataTransfer.files ?? [])
      if (files.length > 0) {
        onFiles(files)
      }
    },
    [enabled, onFiles],
  )

  const handleDragOver = React.useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handleDragEnter = React.useCallback(
    (event: React.DragEvent) => {
      if (!enabled) return
      event.preventDefault()
      event.stopPropagation()
      dragCounter.current += 1
      if (event.dataTransfer.types.includes("Files")) {
        setIsDragging(true)
      }
    },
    [enabled],
  )

  const handleDragLeave = React.useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }, [])

  return {
    isDragging,
    dragHandlers: {
      onDrop: handleDrop,
      onDragOver: handleDragOver,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
    },
  }
}

function fileMatchesMediaKind(file: File, kind: "image" | "video" | "audio") {
  if (kind === "image") return file.type.startsWith("image/")
  if (kind === "video") return file.type.startsWith("video/")
  return file.type.startsWith("audio/")
}

function TemplateMediaInputField({
  input,
  value,
  onChange,
  disabled = false,
  compactDesktop = false,
  previewUrl,
  mediaLabel,
  label,
  onOpenMediaAssetPicker,
}: {
  input: Extract<TemplateInput, { kind: "image" | "video" | "audio" }>
  value: TemplateFieldValue
  onChange: (value: TemplateFieldValue) => void
  disabled?: boolean
  compactDesktop?: boolean
  previewUrl?: string | null
  mediaLabel?: string | null
  label: React.ReactNode
  onOpenMediaAssetPicker?: () => void
}) {
  const mediaFileInputRef = React.useRef<HTMLInputElement | null>(null)
  const accept =
    input.kind === "image" ? "image/*" : input.kind === "video" ? "video/*" : "audio/*"
  const hasMediaValue =
    value instanceof File || (typeof value === "string" && value.startsWith("http"))
  const displayName =
    value instanceof File
      ? value.name
      : mediaLabel?.trim() || (hasMediaValue ? "Asset selected" : "")

  const handleMediaFiles = React.useCallback(
    (files: File[]) => {
      const file = files.find((candidate) => fileMatchesMediaKind(candidate, input.kind))
      if (file) {
        onChange(file)
      }
    },
    [input.kind, onChange],
  )

  const mediaDragDrop = useFileDragDrop(handleMediaFiles, !disabled)

  return (
    <div className="space-y-2">
      {label}
      {input.helpText ? <p className="text-xs text-muted-foreground">{input.helpText}</p> : null}
      <div
        className={cn(
          "relative flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-4 transition-colors",
          compactDesktop && "lg:min-h-[116px] lg:p-3",
          disabled && "opacity-60 pointer-events-none",
          mediaDragDrop.isDragging && "border-primary bg-primary/10",
        )}
        {...mediaDragDrop.dragHandlers}
      >
        <input
          ref={mediaFileInputRef}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            onChange(file)
            if (mediaFileInputRef.current) {
              mediaFileInputRef.current.value = ""
            }
          }}
        />

        {hasMediaValue ? (
          <div className="relative flex w-full flex-col items-center gap-2">
            {input.kind === "image" && previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className={cn(
                  "max-h-48 w-full rounded-lg object-contain",
                  compactDesktop && "lg:max-h-32",
                )}
              />
            ) : input.kind === "video" && previewUrl ? (
              <video
                src={previewUrl}
                muted
                playsInline
                className={cn(
                  "max-h-48 w-full rounded-lg object-contain",
                  compactDesktop && "lg:max-h-32",
                )}
              />
            ) : (
              <p className="text-sm text-muted-foreground truncate max-w-full px-2 text-center">
                {displayName}
              </p>
            )}
            {!disabled ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 size-8"
                aria-label="Remove file"
                onClick={() => onChange(null)}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {input.kind === "image" ? (
              <ImageIcon className="size-8 text-muted-foreground" />
            ) : (
              <UploadSimple className="size-8 text-muted-foreground" />
            )}
            <p className="text-xs text-muted-foreground text-center">Drag and drop a file here</p>
            <div className="flex flex-row items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => mediaFileInputRef.current?.click()}
              >
                <UploadSimple className="mr-2 size-4" />
                {mediaDragDrop.isDragging ? "Drop file here" : "Upload"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || !onOpenMediaAssetPicker}
                onClick={() => onOpenMediaAssetPicker?.()}
              >
                <FolderOpen className="mr-2 size-4" />
                Select asset
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function TemplateInputField({
  input,
  value,
  onChange,
  disabled = false,
  compactDesktop = false,
  previewUrl,
  mediaLabel,
  promptAttachments = [],
  onOpenPromptAssetPicker,
  onOpenMediaAssetPicker,
  onPromptAttachmentFilesSelected,
  onRemovePromptAttachment,
}: TemplateInputFieldProps) {
  const id = `template-input-${input.id}`
  const promptAttachmentInputRef = React.useRef<HTMLInputElement | null>(null)
  const canAttachPromptImages =
    input.kind === "text" &&
    input.multiline &&
    (typeof onPromptAttachmentFilesSelected === "function" || typeof onOpenPromptAssetPicker === "function")

  const handlePromptDropFiles = React.useCallback(
    (files: File[]) => {
      if (!onPromptAttachmentFilesSelected) return
      onPromptAttachmentFilesSelected(files)
    },
    [onPromptAttachmentFilesSelected],
  )

  const promptDragDrop = useFileDragDrop(handlePromptDropFiles, !disabled && canAttachPromptImages)

  const label = (
    <Label htmlFor={id} className="text-sm font-medium">
      {input.label}
      {input.required ? (
        <span className="text-destructive ml-0.5">*</span>
      ) : (
        <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
      )}
    </Label>
  )

  const getAspectDisplay = (option: { value: string; label: string }) =>
    option.value === "auto" ? "Auto" : option.value

  const getAspectPreviewClass = (value: string) => {
    switch (value) {
      case "9:16":
        return "h-4 w-2.5"
      case "1:1":
        return "h-3.5 w-3.5"
      case "16:9":
        return "h-2.5 w-4"
      default:
        return "h-3.5 w-3.5"
    }
  }

  switch (input.kind) {
    case "text":
      return (
        <div className="space-y-2">
          {label}
          {input.multiline ? (
            <div className="space-y-3">
              <div
                className={cn(
                  "relative rounded-xl",
                  canAttachPromptImages && promptDragDrop.isDragging && "ring-2 ring-inset ring-primary/40",
                )}
                {...(canAttachPromptImages ? promptDragDrop.dragHandlers : {})}
              >
                <Textarea
                  id={id}
                  disabled={disabled}
                  rows={4}
                  value={typeof value === "string" ? value : ""}
                  placeholder={input.placeholder}
                  className={cn(canAttachPromptImages && "pb-14")}
                  onChange={(e) => onChange(e.target.value)}
                />

                {canAttachPromptImages ? (
                  <>
                    <input
                      ref={promptAttachmentInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? [])
                        if (files.length > 0) {
                          onPromptAttachmentFilesSelected?.(files)
                        }
                        if (promptAttachmentInputRef.current) {
                          promptAttachmentInputRef.current.value = ""
                        }
                      }}
                    />
                    <div className="absolute bottom-3 left-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Attach reference image"
                            disabled={disabled}
                            className="size-8 rounded-full"
                          >
                            <Plus className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="top" sideOffset={6}>
                          <DropdownMenuItem
                            onClick={() => promptAttachmentInputRef.current?.click()}
                            disabled={disabled || !onPromptAttachmentFilesSelected}
                          >
                            <FilePlus className="mr-2 size-4" />
                            Upload image
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onOpenPromptAssetPicker?.()}
                            disabled={disabled || !onOpenPromptAssetPicker}
                          >
                            <FolderOpen className="mr-2 size-4" />
                            Select asset
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </>
                ) : null}
              </div>

              {promptAttachments.length > 0 && onRemovePromptAttachment ? (
                <ComposerAttachmentPreviews
                  attachments={promptAttachments}
                  onRemove={onRemovePromptAttachment}
                />
              ) : null}
            </div>
          ) : (
            <Input
              id={id}
              disabled={disabled}
              value={typeof value === "string" ? value : ""}
              placeholder={input.placeholder}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </div>
      )

    case "image":
    case "video":
    case "audio":
      return (
        <TemplateMediaInputField
          input={input}
          value={value}
          onChange={onChange}
          disabled={disabled}
          compactDesktop={compactDesktop}
          previewUrl={previewUrl}
          mediaLabel={mediaLabel}
          label={label}
          onOpenMediaAssetPicker={onOpenMediaAssetPicker}
        />
      )

    case "boolean": {
      const checked =
        typeof value === "boolean"
          ? value
          : value === "true"
            ? true
            : Boolean(getDefaultInputValue(input))

      return (
        <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 px-4 py-3">
          <div className="space-y-0.5">
            {label}
          </div>
          <Switch
            id={id}
            disabled={disabled}
            checked={checked}
            onCheckedChange={(next) => onChange(next)}
          />
        </div>
      )
    }

    case "aspect_ratio": {
      const current =
        typeof value === "string" && value.length > 0
          ? value
          : String(getDefaultInputValue(input))

      return (
        <div className="space-y-2">
          {label}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ASPECT_RATIO_PRESETS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                disabled={disabled}
                className={cn(
                  "h-auto justify-center rounded-xl border px-3 py-2 text-xs sm:text-sm",
                  current === option.value
                    ? "border-primary bg-primary/8 text-foreground hover:bg-primary/10"
                    : "border-border/70 bg-background hover:bg-muted/40",
                )}
                onClick={() => onChange(option.value)}
              >
                <div className="flex items-center justify-center gap-2 text-left">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <div
                      className={cn(
                        "rounded-[4px] border-2 border-current",
                        option.value === "auto" && "border-dashed",
                        getAspectPreviewClass(option.value),
                        current === option.value ? "text-foreground" : "text-foreground/90",
                      )}
                    />
                  </div>
                  <span className="text-sm font-medium tracking-tight">
                    {getAspectDisplay(option)}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </div>
      )
    }

    default:
      return null
  }
}
