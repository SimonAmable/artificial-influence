"use client"

import * as React from "react"
import { Check, Copy } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CopyFieldProps = {
  value: string
  mono?: boolean
  className?: string
}

export function CopyField({ value, mono = true, className }: CopyFieldProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [value])

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-border/70 bg-background/80 p-2 pl-4",
        className,
      )}
    >
      <code
        className={cn(
          "min-w-0 flex-1 truncate text-sm text-primary",
          mono && "font-mono",
        )}
      >
        {value}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
}
