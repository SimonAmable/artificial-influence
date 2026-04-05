"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import {
  CaretDownIcon,
  CheckIcon,
  CircleNotch,
  PauseIcon,
  PlayIcon,
} from "@phosphor-icons/react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type VoiceSelectorContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  value?: string
  setValue: (value: string | undefined) => void
  query: string
  setQuery: (query: string) => void
}

const VoiceSelectorContext =
  React.createContext<VoiceSelectorContextValue | null>(null)

export function useVoiceSelector() {
  const context = React.useContext(VoiceSelectorContext)

  if (!context) {
    throw new Error("useVoiceSelector must be used inside VoiceSelector")
  }

  return context
}

export function VoiceSelector({
  value,
  defaultValue,
  onValueChange,
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string | undefined) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<
    string | undefined
  >(defaultValue)
  const [uncontrolledOpen, setUncontrolledOpen] =
    React.useState(defaultOpen)
  const [query, setQuery] = React.useState("")

  const resolvedValue = value ?? uncontrolledValue
  const resolvedOpen = open ?? uncontrolledOpen

  const setValue = React.useCallback(
    (nextValue: string | undefined) => {
      if (value === undefined) {
        setUncontrolledValue(nextValue)
      }

      onValueChange?.(nextValue)
    },
    [onValueChange, value]
  )

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (open === undefined) {
        setUncontrolledOpen(nextOpen)
      }

      if (!nextOpen) {
        setQuery("")
      }

      onOpenChange?.(nextOpen)
    },
    [onOpenChange, open]
  )

  return (
    <VoiceSelectorContext.Provider
      value={{
        open: resolvedOpen,
        setOpen,
        value: resolvedValue,
        setValue,
        query,
        setQuery,
      }}
    >
      <Dialog open={resolvedOpen} onOpenChange={setOpen}>
        {children}
      </Dialog>
    </VoiceSelectorContext.Provider>
  )
}

export function VoiceSelectorTrigger({
  className,
  children,
  asChild = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return (
    <DialogPrimitive.Trigger asChild={asChild} className={className} {...props}>
      {children}
    </DialogPrimitive.Trigger>
  )
}

export function VoiceSelectorContent({
  title = "Voice selector",
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent> & {
  title?: React.ReactNode
}) {
  return (
    <DialogContent className={cn("max-w-md p-0 overflow-hidden", className)} {...props}>
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <div className="flex max-h-[70vh] min-w-0 flex-col">{children}</div>
    </DialogContent>
  )
}

export function VoiceSelectorInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  const { query, setQuery } = useVoiceSelector()

  return (
    <div className="min-w-0 border-b border-white/10 px-3 py-3">
      <input
        className={cn(
          "box-border w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500",
          className
        )}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        {...props}
      />
    </div>
  )
}

export function VoiceSelectorList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("max-h-[24rem] overflow-y-auto p-2", className)}
      {...props}
    />
  )
}

export function VoiceSelectorEmpty({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("px-3 py-5 text-center text-sm text-zinc-500", className)}
      {...props}
    />
  )
}

export function VoiceSelectorGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("mb-2", className)} {...props} />
}

export function VoiceSelectorSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("mx-1 my-2 h-px bg-white/10", className)} {...props} />
  )
}

export function VoiceSelectorItem({
  className,
  value,
  onSelect,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "value"> & {
  value: string
  onSelect?: (value: string) => void
}) {
  const { value: selectedValue, setValue, setOpen } = useVoiceSelector()
  const selected = selectedValue === value

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-900/80",
        selected && "bg-zinc-900 text-zinc-50",
        className
      )}
      onClick={() => {
        setValue(value)
        onSelect?.(value)
        setOpen(false)
      }}
      {...props}
    >
      {children}
      {selected ? <CheckIcon className="ml-auto size-4 text-zinc-300" /> : null}
    </button>
  )
}

export function VoiceSelectorName({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return <span className={cn("font-medium text-zinc-100", className)} {...props} />
}

export function VoiceSelectorDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return <span className={cn("text-zinc-400", className)} {...props} />
}

export function VoiceSelectorAttributes({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-1.5 text-xs text-zinc-500", className)} {...props} />
}

export function VoiceSelectorBullet({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return <span aria-hidden className={cn("text-zinc-600", className)} {...props}>•</span>
}

export function VoiceSelectorAccent({
  className,
  ...props
}: React.ComponentProps<"span"> & { value?: unknown }) {
  return <span className={cn("text-zinc-500", className)} {...props} />
}

export function VoiceSelectorAge({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return <span className={cn("text-zinc-500", className)} {...props} />
}

export function VoiceSelectorGender({
  className,
  ...props
}: React.ComponentProps<"span"> & { value?: unknown }) {
  return <span className={cn("text-zinc-500", className)} {...props} />
}

export function VoiceSelectorShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return <span className={cn("ml-auto text-xs text-zinc-500", className)} {...props} />
}

export function VoiceSelectorPreview({
  playing,
  loading,
  onPlay,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onPlay"> & {
  playing?: boolean
  loading?: boolean
  onPlay?: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full border border-white/10 bg-zinc-950/70 text-zinc-300 transition-colors hover:bg-zinc-800",
        className
      )}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onPlay?.()
      }}
      {...props}
    >
      {loading ? (
        <CircleNotch className="size-3.5 animate-spin" />
      ) : playing ? (
        <PauseIcon className="size-3.5" weight="fill" />
      ) : (
        <PlayIcon className="size-3.5" weight="fill" />
      )}
    </button>
  )
}
