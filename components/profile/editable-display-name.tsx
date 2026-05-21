"use client"

import { Loader2, Pencil } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { updateProfileDisplayName } from "@/app/profile/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type EditableDisplayNameProps = {
  initialName: string
  size?: "page" | "compact"
  onNameUpdated?: (name: string) => void
}

const sizeStyles = {
  page: {
    heading: "text-3xl font-semibold tracking-tight",
    input:
      "h-auto min-h-12 rounded-xl border-border/80 py-2 text-3xl font-semibold tracking-tight md:text-3xl",
  },
  compact: {
    heading: "text-xl font-semibold tracking-tight",
    input:
      "h-auto min-h-10 rounded-xl border-border/80 py-1.5 text-xl font-semibold tracking-tight",
  },
} as const

export function EditableDisplayName({
  initialName,
  size = "page",
  onNameUpdated,
}: EditableDisplayNameProps) {
  const styles = sizeStyles[size]
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const skipBlurCommitRef = useRef(false)

  useEffect(() => {
    if (editing) return
    setName(initialName)
    setDraft(initialName)
  }, [initialName, editing])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed === name.trim()) {
      setEditing(false)
      return
    }
    setError(null)
    startTransition(() => {
      void (async () => {
        const result = await updateProfileDisplayName(trimmed)
        if (!result.ok) {
          setError(result.error)
          return
        }
        setName(trimmed)
        setDraft(trimmed)
        setEditing(false)
        onNameUpdated?.(trimmed)
        router.refresh()
      })()
    })
  }

  function cancel() {
    setDraft(name)
    setError(null)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => {
              if (skipBlurCommitRef.current) {
                skipBlurCommitRef.current = false
                return
              }
              commit()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
              if (e.key === "Escape") {
                e.preventDefault()
                skipBlurCommitRef.current = true
                cancel()
              }
            }}
            disabled={isPending}
            aria-invalid={error ? true : undefined}
            className={cn(styles.input)}
          />
          {isPending ? (
            <Loader2
              className="h-5 w-5 shrink-0 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : null}
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <h1 className={styles.heading}>{name}</h1>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => {
          setDraft(name)
          setError(null)
          setEditing(true)
        }}
        aria-label="Edit display name"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  )
}
