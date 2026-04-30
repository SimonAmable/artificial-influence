"use client"

import * as React from "react"
import { Brain, CaretDown } from "@phosphor-icons/react"
import { MessageResponse } from "@/components/ai-elements/message"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ReasoningContextValue = {
  durationMs: number
  isOpen: boolean
  isStreaming: boolean
  setIsOpen: (open: boolean) => void
}

const ReasoningContext = React.createContext<ReasoningContextValue | null>(null)

function useReasoningContext() {
  const context = React.useContext(ReasoningContext)

  if (!context) {
    throw new Error("Reasoning components must be used within <Reasoning>.")
  }

  return context
}

export type ReasoningProps = React.HTMLAttributes<HTMLDivElement> & {
  isStreaming?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Reasoning({
  children,
  className,
  defaultOpen = true,
  isStreaming = false,
  onOpenChange,
  open,
  ...props
}: ReasoningProps) {
  const isControlled = open !== undefined
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const [durationMs, setDurationMs] = React.useState(0)
  const startTimeRef = React.useRef<number | null>(null)
  const isOpen = isControlled ? open : internalOpen

  const setIsOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen)
      }
      onOpenChange?.(nextOpen)
    },
    [isControlled, onOpenChange],
  )

  React.useEffect(() => {
    if (!isStreaming) {
      startTimeRef.current = null
      return
    }

    setIsOpen(true)
    const start = Date.now()
    startTimeRef.current = start
    setDurationMs(0)

    const interval = window.setInterval(() => {
      setDurationMs(Date.now() - start)
    }, 100)

    return () => {
      window.clearInterval(interval)
      setDurationMs(Date.now() - start)
    }
  }, [isStreaming, setIsOpen])

  React.useEffect(() => {
    if (isStreaming) return

    const timer = window.setTimeout(() => {
      setIsOpen(false)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [isStreaming, setIsOpen])

  const contextValue = React.useMemo(
    () => ({
      durationMs,
      isOpen,
      isStreaming,
      setIsOpen,
    }),
    [durationMs, isOpen, isStreaming, setIsOpen],
  )

  return (
    <ReasoningContext.Provider value={contextValue}>
      <div
        className={cn("overflow-hidden rounded-2xl border border-border/60 bg-background/70", className)}
        {...props}
      >
        {children}
      </div>
    </ReasoningContext.Provider>
  )
}

export type ReasoningTriggerProps = React.ComponentProps<typeof Button> & {
  getThinkingMessage?: (isStreaming: boolean, durationSeconds: number) => React.ReactNode
}

export function ReasoningTrigger({
  children,
  className,
  getThinkingMessage,
  onClick,
  variant = "ghost",
  ...props
}: ReasoningTriggerProps) {
  const { durationMs, isOpen, isStreaming, setIsOpen } = useReasoningContext()
  const durationSeconds = durationMs / 1000
  const defaultLabel = isStreaming
    ? "Thinking..."
    : durationSeconds >= 1
      ? `Thought for ${durationSeconds.toFixed(1)}s`
      : "Thought for a moment"

  return (
    <Button
      className={cn("flex h-auto w-full items-center justify-between rounded-none px-3 py-2 text-left", className)}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        setIsOpen(!isOpen)
      }}
      type="button"
      variant={variant}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
        <Brain className={cn("size-4 shrink-0", isStreaming && "animate-pulse")} />
        <span className="truncate">
          {children ?? getThinkingMessage?.(isStreaming, durationSeconds) ?? defaultLabel}
        </span>
      </span>
      <CaretDown
        className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
      />
    </Button>
  )
}

export type ReasoningContentProps = Omit<React.HTMLAttributes<HTMLDivElement>, "children"> & {
  children: string
}

export function ReasoningContent({ children, className, ...props }: ReasoningContentProps) {
  const { isOpen } = useReasoningContext()

  if (!isOpen) {
    return null
  }

  return (
    <div className={cn("border-t border-border/60 px-3 py-3", className)} {...props}>
      <MessageResponse className="text-muted-foreground">{children || "..."}</MessageResponse>
    </div>
  )
}
