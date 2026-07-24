"use client"

import * as React from "react"
import { CircleNotch, Sparkle } from "@phosphor-icons/react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getControlLayoutTransition } from "./animated-control-item"

type GenerateShaderButtonLayout = "compact" | "bar"

type GenerateShaderButtonProps = {
  isReady: boolean
  isGenerating: boolean
  allowConcurrent: boolean
  onGenerate?: () => void
  creditCost: number | string
  /** Shown when generating with concurrent queue enabled */
  activeSlotCount?: number
  /** `bar` = full-width single row for custom tools; `compact` = side column (default) */
  layout?: GenerateShaderButtonLayout
}

function AnimatedCreditCost({ value }: { value: number | string }) {
  const prefersReducedMotion = useReducedMotion()
  const displayValue = String(value)

  return (
    <span className="relative inline-grid h-[14px] overflow-hidden">
      <span
        aria-hidden
        className="invisible col-start-1 row-start-1 text-[10px] font-bold leading-[14px]"
      >
        {displayValue}
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={displayValue}
          initial={
            prefersReducedMotion
              ? { opacity: 0 }
              : { y: "100%", opacity: 0 }
          }
          animate={
            prefersReducedMotion
              ? { opacity: 1 }
              : { y: 0, opacity: 1 }
          }
          exit={
            prefersReducedMotion
              ? { opacity: 0 }
              : { y: "-100%", opacity: 0 }
          }
          transition={{
            duration: prefersReducedMotion ? 0.12 : 0.24,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="col-start-1 row-start-1 text-[10px] font-bold leading-[14px] text-white"
        >
          {displayValue}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function GenerateShaderButtonComponent({
  isReady,
  isGenerating,
  allowConcurrent,
  onGenerate,
  creditCost,
  activeSlotCount = 0,
  layout = "compact",
}: GenerateShaderButtonProps) {
  const prefersReducedMotion = useReducedMotion()
  const layoutTransition = getControlLayoutTransition(prefersReducedMotion)
  const onGenerateRef = React.useRef(onGenerate)
  const showGeneratingState = isGenerating && !allowConcurrent
  const showActiveBadge = allowConcurrent && isGenerating && activeSlotCount > 1
  const isBarLayout = layout === "bar"

  onGenerateRef.current = onGenerate

  const handleGenerate = React.useCallback(() => {
    onGenerateRef.current?.()
  }, [])

  const labelContent = showGeneratingState ? (
    <span className="inline-flex items-center justify-center gap-1.5">
      <CircleNotch className="size-3.5 shrink-0 animate-spin" aria-hidden />
      <span className="whitespace-nowrap">Generating...</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      <span>Generate</span>
      {showActiveBadge ? (
        <span className="rounded-full bg-white/15 px-1.5 py-px text-[9px] font-medium leading-4 text-white/90">
          {activeSlotCount} active
        </span>
      ) : null}
    </span>
  )

  const creditContent = (
    <div className="flex items-center gap-0.5 font-bold text-white">
      <Sparkle size={8} weight="fill" className="text-white" />
      <AnimatedCreditCost value={creditCost} />
    </div>
  )

  return (
    <motion.div
      layout
      transition={layoutTransition}
      className={cn(isBarLayout ? "w-full" : "shrink-0")}
    >
      <motion.div
        layout
        transition={layoutTransition}
        className={cn(
          "relative transition-colors duration-300",
          isBarLayout ? "block w-full" : "inline-block",
          isReady &&
            "before:absolute before:inset-[-12px] before:-z-10 before:rounded-full before:bg-[#00D3FF] before:opacity-40 before:blur-[15px] before:content-['']",
          isBarLayout &&
            isReady &&
            "before:rounded-2xl before:inset-[-8px]",
        )}
      >
        <Button
          onClick={handleGenerate}
          disabled={!isReady || (isGenerating && !allowConcurrent)}
          className={cn(
            "relative z-0 h-10 border-0 bg-black text-sm font-bold text-white shadow-none transition-colors duration-300 hover:bg-black/90 dark:bg-black dark:text-white dark:hover:bg-black/90",
            isBarLayout
              ? "w-full px-4 py-2.5"
              : "min-w-[100px] px-4 py-6",
            !isReady && "cursor-not-allowed opacity-50",
          )}
        >
          <motion.div
            layout
            transition={layoutTransition}
            className={cn(
              "text-white",
              isBarLayout
                ? "flex flex-row items-center justify-center gap-2"
                : "flex flex-col items-center gap-0.5",
            )}
          >
            <motion.span
              layout="position"
              transition={layoutTransition}
              className="text-sm font-bold text-white"
            >
              {labelContent}
            </motion.span>
            <motion.div layout="position" transition={layoutTransition}>
              {creditContent}
            </motion.div>
          </motion.div>
        </Button>
      </motion.div>
    </motion.div>
  )
}

function propsAreEqual(prev: GenerateShaderButtonProps, next: GenerateShaderButtonProps) {
  return (
    prev.isReady === next.isReady &&
    prev.isGenerating === next.isGenerating &&
    prev.allowConcurrent === next.allowConcurrent &&
    prev.creditCost === next.creditCost &&
    prev.activeSlotCount === next.activeSlotCount &&
    prev.layout === next.layout
  )
}

export const GenerateShaderButton = React.memo(GenerateShaderButtonComponent, propsAreEqual)
