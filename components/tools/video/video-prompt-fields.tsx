"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { extractClipboardImageFiles } from "@/lib/utils/clipboard"

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
}

export function VideoPromptFields({
  promptValue,
  onPromptChange,
  negativePromptValue,
  onNegativePromptChange,
  showNegativePrompt = false,
  placeholder = "Describe the video you want to generate...",
  className,
  variant = "page",
  onPromptKeyDown,
  onPasteImage,
}: VideoPromptFieldsProps) {
  const isToolbar = variant === "toolbar"

  const handlePaste = React.useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedImage = extractClipboardImageFiles(e.clipboardData?.items)[0]
    if (!pastedImage || !onPasteImage) return

    e.preventDefault()
    e.stopPropagation()
    onPasteImage(pastedImage)
  }, [onPasteImage])

  return (
    <div className={cn("flex-1", className)}>
      <textarea
        value={promptValue}
        onChange={(e) => onPromptChange(e.target.value)}
        onKeyDown={onPromptKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        className={cn(
          "w-full border-none outline-none resize-none bg-transparent text-sm",
          isToolbar ? "min-h-[50px] max-h-[120px]" : "min-h-[60px] max-h-[120px]"
        )}
        rows={isToolbar ? 2 : 3}
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
