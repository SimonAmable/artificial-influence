import { Plus } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

const TOKEN_RE = /(\{\{@\}\}|\{\{\+\}\})/g

function AtChip() {
  return (
    <span
      className={cn(
        "mx-0.5 inline-flex items-center gap-0.5 rounded-sm bg-muted/70 px-1.5 py-0.5 align-middle",
        "font-semibold tracking-tight text-foreground"
      )}
    >
      <span aria-hidden>@</span>
      <span className="text-[0.85em] font-medium text-muted-foreground">mention</span>
    </span>
  )
}

function PlusCreateChip() {
  return (
    <span
      className={cn(
        "mx-0.5 inline-flex items-center gap-1 rounded-lg border border-dashed border-primary/45 bg-primary/5 px-1.5 py-0.5 align-middle",
        "text-primary"
      )}
    >
      <Plus className="size-3.5 shrink-0" weight="bold" aria-hidden />
      <span className="text-[0.7rem] font-bold tracking-tight text-foreground">Create</span>
    </span>
  )
}

/** Renders overview copy with inline `{{@}}` and `{{+}}` chips. */
export function GuideOverviewText({ text }: { text: string }) {
  const parts = text.split(TOKEN_RE)

  return (
    <>
      {parts.map((part, index) => {
        if (part === "{{@}}") {
          return <AtChip key={`at-${index}`} />
        }
        if (part === "{{+}}") {
          return <PlusCreateChip key={`plus-${index}`} />
        }
        return <span key={`text-${index}`}>{part}</span>
      })}
    </>
  )
}
