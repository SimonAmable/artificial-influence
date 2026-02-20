"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ImagePromptFieldsProps {
  promptValue: string
  onPromptChange: (value: string) => void
  /** Optional read-only prompt from connected text nodes (toolbar/canvas only) */
  connectedPrompt?: string
  placeholder?: string
  className?: string
  /** "page" = image page layout; "toolbar" = compact canvas; "node" = same sizing as page, dark theme + connected prompt */
  variant?: "page" | "toolbar" | "node"
  onPromptKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  /** When pasting an image, called with the file; if handler returns true, default paste is prevented */
  onPasteImage?: (file: File) => void
}

export function ImagePromptFields({
  promptValue,
  onPromptChange,
  connectedPrompt,
  placeholder = "Enter your prompt...",
  className,
  variant = "page",
  onPromptKeyDown,
  onPasteImage,
}: ImagePromptFieldsProps) {
  const [isPromptExpanded, setIsPromptExpanded] = React.useState(false)
  const isToolbar = variant === "toolbar" || variant === "node"
  const isNode = variant === "node"

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items
      if (!items || !onPasteImage) return
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            e.stopPropagation()
            onPasteImage(file)
            return
          }
        }
      }
    },
    [onPasteImage]
  )

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Connected prompt from text nodes (toolbar only) */}
      {isToolbar && connectedPrompt && (
        <div className="mb-2">
          <div
            className={cn(
              "relative overflow-hidden transition-all duration-200 cursor-pointer hover:bg-zinc-800/30 rounded-lg p-2",
              !isPromptExpanded && "max-h-[60px]"
            )}
            onClick={() => setIsPromptExpanded(!isPromptExpanded)}
          >
            <div
              className={cn(
                "text-sm text-zinc-500 italic",
                !isPromptExpanded && "line-clamp-2"
              )}
            >
              {connectedPrompt}
            </div>
            {!isPromptExpanded && (
              <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-zinc-900/95 to-transparent pointer-events-none" />
            )}
          </div>
          {isPromptExpanded && (
            <div className="text-xs text-zinc-600 mt-1 px-2">Click to collapse</div>
          )}
        </div>
      )}

      <textarea
        value={promptValue}
        onChange={(e) => onPromptChange(e.target.value)}
        onKeyDown={onPromptKeyDown}
        onPaste={handlePaste}
        placeholder={
          isToolbar && connectedPrompt
            ? "Add more to the prompt..."
            : isToolbar
              ? "Type a prompt or press '/' for commands..."
              : placeholder
        }
        rows={isToolbar && !isNode ? 2 : 3}
        className={cn(
          "w-full border-none outline-none resize-none bg-transparent text-sm overflow-y-auto",
          variant === "toolbar" && "min-h-[50px] max-h-[120px] text-zinc-200 placeholder:text-zinc-600",
          variant === "page" && "min-h-[60px] max-h-[120px]",
          isNode && "min-h-[60px] max-h-[120px] text-zinc-200 placeholder:text-zinc-500"
        )}
      />
    </div>
  )
}
