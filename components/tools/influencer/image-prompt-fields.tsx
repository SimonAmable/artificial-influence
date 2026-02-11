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
  /** "page" = image page layout; "toolbar" = canvas node toolbar (compact, dark theme) */
  variant?: "page" | "toolbar"
  onPromptKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export function ImagePromptFields({
  promptValue,
  onPromptChange,
  connectedPrompt,
  placeholder = "Enter your prompt...",
  className,
  variant = "page",
  onPromptKeyDown,
}: ImagePromptFieldsProps) {
  const [isPromptExpanded, setIsPromptExpanded] = React.useState(false)
  const isToolbar = variant === "toolbar"

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
        placeholder={
          isToolbar && connectedPrompt
            ? "Add more to the prompt..."
            : isToolbar
              ? "Type a prompt or press '/' for commands..."
              : placeholder
        }
        rows={isToolbar ? 2 : 3}
        className={cn(
          "w-full border-none outline-none resize-none bg-transparent text-sm overflow-y-auto",
          isToolbar
            ? "min-h-[50px] max-h-[120px] text-zinc-200 placeholder:text-zinc-600"
            : "min-h-[60px] max-h-[120px]"
        )}
      />
    </div>
  )
}
