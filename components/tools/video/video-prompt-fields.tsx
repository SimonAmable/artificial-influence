"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { extractClipboardImageFiles } from "@/lib/utils/clipboard"
import type { AttachedRef, SlashCommandUiAction } from "@/lib/commands/types"
import type { AssetType } from "@/lib/assets/types"
import type { CommandItem } from "@/lib/commands/types"
import { CommandTextarea } from "@/components/commands/command-textarea"

interface VideoPromptFieldsProps {
  promptValue: string
  onPromptChange: (value: string) => void
  negativePromptValue: string
  onNegativePromptChange: (value: string) => void
  showNegativePrompt?: boolean
  placeholder?: string
  className?: string
  variant?: "page" | "toolbar"
  onPromptKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onPasteImage?: (file: File) => void
  attachedRefs?: AttachedRef[]
  onRefsChange?: (refs: AttachedRef[]) => void
  allowedAssetTypes?: AssetType[]
  slashCommands?: CommandItem[]
  slashCommandsContext?: string | null
  onSlashUiAction?: (action: SlashCommandUiAction) => void
}

export function VideoPromptFields({
  promptValue,
  onPromptChange,
  negativePromptValue,
  onNegativePromptChange,
  showNegativePrompt = false,
  placeholder = "Describe the video you want to generate — use / for presets and @ for brand kits & assets.",
  className,
  variant = "page",
  onPromptKeyDown,
  onPasteImage,
  attachedRefs = [],
  onRefsChange = () => {},
  allowedAssetTypes,
  slashCommands,
  slashCommandsContext = "Video Prompts",
  onSlashUiAction,
}: VideoPromptFieldsProps) {
  const isToolbar = variant === "toolbar"

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedImage = extractClipboardImageFiles(e.clipboardData?.items)[0]
      if (!pastedImage || !onPasteImage) return

      e.preventDefault()
      e.stopPropagation()
      onPasteImage(pastedImage)
    },
    [onPasteImage]
  )

  const textareaClassName = cn(
    "w-full border-none outline-none resize-none bg-transparent text-sm overflow-y-auto",
    isToolbar ? "min-h-[50px] max-h-[120px]" : "min-h-[60px] max-h-[120px]"
  )

  const rows = isToolbar ? 2 : 3

  return (
    <div className={cn("flex-1", className)}>
      <CommandTextarea
        value={promptValue}
        onChange={onPromptChange}
        refs={attachedRefs}
        onRefsChange={onRefsChange}
        rows={rows}
        className={textareaClassName}
        placeholder={placeholder}
        onPromptKeyDown={onPromptKeyDown}
        onPasteImage={onPasteImage}
        allowedAssetTypes={allowedAssetTypes}
        slashCommandsContext={slashCommandsContext}
        slashCommands={slashCommands}
        onSlashUiAction={onSlashUiAction}
      />
      {showNegativePrompt && (
        <textarea
          value={negativePromptValue}
          onChange={(e) => onNegativePromptChange(e.target.value)}
          onPaste={handlePaste}
          placeholder="What to exclude from the video..."
          className={cn(
            "w-full border-none outline-none resize-none bg-transparent text-xs text-muted-foreground mt-1",
            isToolbar ? "min-h-[36px] max-h-[80px]" : "min-h-[40px] max-h-[80px]"
          )}
          rows={2}
        />
      )}
    </div>
  )
}
