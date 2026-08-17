"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export function MotionCopyPromptField({
  value,
  onChange,
  onGenerate,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  onGenerate?: () => void
  disabled?: boolean
  className?: string
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const syncHeight = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [])

  React.useLayoutEffect(() => {
    syncHeight()
  }, [syncHeight, value])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault()
          onGenerate?.()
        }
      }}
      rows={1}
      disabled={disabled}
      placeholder="Optional prompt (e.g. smiling, keep the same outfit)"
      aria-label="Optional motion control prompt"
      className={cn(
        "w-full resize-none overflow-y-auto border-none bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground max-h-20",
        className,
      )}
    />
  )
}
