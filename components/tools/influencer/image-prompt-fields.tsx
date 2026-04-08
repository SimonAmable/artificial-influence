"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { AttachedRef, SlashCommandUiAction } from "@/lib/commands/types"
import type { AssetType } from "@/lib/assets/types"
import { CommandTextarea } from "@/components/commands/command-textarea"

export interface ImagePromptFieldsProps {
  promptValue: string
  onPromptChange: (value: string) => void
  /** @-reference chips (merged into prompt on generate) */
  attachedRefs?: AttachedRef[]
  onRefsChange?: (refs: AttachedRef[]) => void
  /** Optional read-only prompt from connected text nodes (toolbar/canvas only) */
  connectedPrompt?: string
  placeholder?: string
  className?: string
  /** "page" = image page layout; "toolbar" = compact canvas; "node" = same sizing as page, dark theme + connected prompt */
  variant?: "page" | "toolbar" | "node"
  onPromptKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  /** When pasting an image, called with the file; if handler returns true, default paste is prevented */
  onPasteImage?: (file: File) => void
  /** Restrict @ → assets list (e.g. `["image"]` on /image) */
  allowedAssetTypes?: AssetType[]
  /** Badge to the right of each / command title (preset family label) */
  slashCommandsContext?: string | null
  onSlashUiAction?: (action: SlashCommandUiAction) => void
}

export function ImagePromptFields({
  promptValue,
  onPromptChange,
  attachedRefs = [],
  onRefsChange = () => {},
  connectedPrompt,
  placeholder = "Describe your image — use / for presets and @ for brand kits & assets.",
  className,
  variant = "page",
  onPromptKeyDown,
  onPasteImage,
  allowedAssetTypes,
  slashCommandsContext = "Image Prompts",
  onSlashUiAction,
}: ImagePromptFieldsProps) {
  const [isPromptExpanded, setIsPromptExpanded] = React.useState(false)
  const isToolbar = variant === "toolbar" || variant === "node"
  const isNode = variant === "node"

  const placeholderResolved =
    isToolbar && connectedPrompt
      ? "Add more — / for presets, @ for brand kits & assets."
      : isToolbar
        ? "Type a prompt — / for presets, @ for brand kits & assets."
        : placeholder

  const textareaClassName = cn(
    "w-full border-none outline-none resize-none bg-transparent text-sm overflow-y-auto",
    variant === "toolbar" && "min-h-[50px] max-h-[120px] text-zinc-200 placeholder:text-zinc-600",
    variant === "page" && "min-h-[60px] max-h-[120px]",
    isNode && "min-h-[60px] max-h-[120px] text-zinc-200 placeholder:text-zinc-500"
  )

  const rows = isToolbar && !isNode ? 2 : 3

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

      <CommandTextarea
        value={promptValue}
        onChange={onPromptChange}
        refs={attachedRefs}
        onRefsChange={onRefsChange}
        rows={rows}
        className={textareaClassName}
        placeholder={placeholderResolved}
        onPromptKeyDown={onPromptKeyDown}
        onPasteImage={onPasteImage}
        allowedAssetTypes={allowedAssetTypes}
        slashCommandsContext={slashCommandsContext}
        onSlashUiAction={onSlashUiAction}
      />
    </div>
  )
}
