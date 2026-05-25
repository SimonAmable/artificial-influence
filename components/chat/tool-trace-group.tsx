"use client"

import * as React from "react"
import type { UIMessage } from "ai"
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought"
import {
  getTraceCotGroupHeader,
  getTraceToolStepMeta,
  traceCotGroupIsActive,
  type TraceCotCategory,
} from "@/lib/chat/trace-tool-cot"
import { cn } from "@/lib/utils"

export function ToolTraceGroup({
  category,
  indices,
  message,
  renderPartAtIndex,
}: {
  category: TraceCotCategory
  indices: number[]
  message: UIMessage
  renderPartAtIndex: (index: number) => React.ReactNode
}) {
  const isActive = traceCotGroupIsActive(message.parts, indices)
  const [detailsOpenByIndex, setDetailsOpenByIndex] = React.useState<Record<number, boolean>>({})

  const toggleDetails = (index: number) => {
    setDetailsOpenByIndex((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  return (
    <ChainOfThought className="w-full" defaultOpen={isActive}>
      <ChainOfThoughtHeader>{getTraceCotGroupHeader(category, isActive)}</ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {indices.map((index) => {
          const meta = getTraceToolStepMeta(message.parts[index])
          const detailsOpen = detailsOpenByIndex[index] === true

          return (
            <ChainOfThoughtStep
              key={`${message.id}-trace-step-${index}`}
              description={meta.description}
              label={meta.label}
              status={meta.status}
            >
              <button
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => toggleDetails(index)}
                type="button"
              >
                {detailsOpen ? "Hide details" : "Show details"}
              </button>
              {detailsOpen ? (
                <div className={cn("mt-2 [&_[class*='border-border']]:border-border/50")}>
                  {renderPartAtIndex(index)}
                </div>
              ) : null}
            </ChainOfThoughtStep>
          )
        })}
      </ChainOfThoughtContent>
    </ChainOfThought>
  )
}
