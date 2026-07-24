"use client"

import * as React from "react"
import { CircleNotch, PaperPlaneTilt, Sparkle } from "@phosphor-icons/react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { AuroraShaderBackground } from "@/components/ui/aurora-shader-background"
import { AURORA_SHADER_GLOW } from "@/lib/constants/aurora-shader"
import { cn } from "@/lib/utils"
import { getControlLayoutTransition } from "./animated-control-item"

type GenerateShaderButtonLayout = "compact" | "bar" | "icon"

type GenerateShaderButtonProps = {
  isReady: boolean
  isGenerating: boolean
  allowConcurrent: boolean
  onGenerate?: () => void
  creditCost: number | string
  /** Shown when generating with concurrent queue enabled */
  activeSlotCount?: number
  /** `bar` = full-width single row; `compact` = side column; `icon` = send icon for toolbar */
  layout?: GenerateShaderButtonLayout
  className?: string
}

function AnimatedCreditCost({ value }: { value: number | string }) {
  const prefersReducedMotion = useReducedMotion()
  const displayValue = String(value)

  return (
    <span className="relative inline-grid h-4 overflow-hidden">
      <span
        aria-hidden
        className="invisible col-start-1 row-start-1 text-xs font-bold leading-4"
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
          className="col-start-1 row-start-1 text-xs font-bold leading-4 text-white"
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
  className,
}: GenerateShaderButtonProps) {
  const prefersReducedMotion = useReducedMotion()
  const layoutTransition = getControlLayoutTransition(prefersReducedMotion)
  const onGenerateRef = React.useRef(onGenerate)
  const buttonShellRef = React.useRef<HTMLDivElement>(null)
  const showGeneratingState = isGenerating && !allowConcurrent
  const showActiveBadge = allowConcurrent && isGenerating && activeSlotCount > 1
  const isBarLayout = layout === "bar"
  const isIconLayout = layout === "icon"
  const showShader = isReady
  const animateShader = isReady && !prefersReducedMotion
  const fastShader = isGenerating && !prefersReducedMotion

  onGenerateRef.current = onGenerate

  const handleGenerate = React.useCallback(() => {
    onGenerateRef.current?.()
  }, [])

  const labelContent = showGeneratingState ? (
    isIconLayout ? (
      <CircleNotch className="size-4 shrink-0 animate-spin" aria-hidden />
    ) : (
      <span className="inline-flex items-center justify-center gap-1.5 uppercase">
        <CircleNotch className="size-4 shrink-0 animate-spin" aria-hidden />
        <span className="whitespace-nowrap">Generating...</span>
      </span>
    )
  ) : isIconLayout ? (
    <PaperPlaneTilt className="size-4 shrink-0" weight="fill" aria-hidden />
  ) : (
    <span className="inline-flex items-center gap-1.5 uppercase">
      <span>Generate</span>
      {showActiveBadge ? (
        <span className="rounded-full bg-white/15 px-1.5 py-px text-[10px] font-medium leading-4 tracking-wide text-white/90 uppercase">
          {activeSlotCount} active
        </span>
      ) : null}
    </span>
  )

  const creditContent = (
    <div className="flex items-center gap-0.5 font-bold text-white">
      <Sparkle size={isIconLayout ? 10 : 11} weight="fill" className="text-white" />
      <AnimatedCreditCost value={creditCost} />
    </div>
  )

  const ariaLabel = showGeneratingState
    ? "Generating"
    : showActiveBadge
      ? `Generate (${activeSlotCount} active)`
      : "Generate"

  return (
    <motion.div
      layout
      transition={layoutTransition}
      className={cn(
        isBarLayout ? "w-full" : "shrink-0",
        className,
      )}
    >
      <motion.div
        ref={buttonShellRef}
        layout
        transition={layoutTransition}
        className={cn(
          "relative transition-colors duration-300",
          isBarLayout ? "block w-full" : "inline-block",
          isReady &&
            "before:absolute before:inset-[-12px] before:-z-10 before:rounded-full before:bg-[var(--generate-shader-glow)] before:opacity-40 before:blur-[15px] before:content-['']",
          isBarLayout &&
            isReady &&
            "before:rounded-2xl before:inset-[-8px]",
          isIconLayout &&
            isReady &&
            "before:inset-[-6px] before:blur-[10px]",
        )}
        style={
          isReady
            ? ({ ["--generate-shader-glow" as string]: AURORA_SHADER_GLOW } as React.CSSProperties)
            : undefined
        }
      >
        <Button
          onClick={handleGenerate}
          disabled={!isReady || (isGenerating && !allowConcurrent)}
          aria-label={ariaLabel}
          className={cn(
            "relative z-0 overflow-hidden border-0 font-bold uppercase tracking-wide text-white shadow-none transition-colors duration-300",
            showShader
              ? "bg-transparent hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
              : "bg-black hover:bg-black/90 dark:bg-black dark:text-white dark:hover:bg-black/90",
            isBarLayout && "h-11 w-full px-4 py-2.5 text-base",
            isIconLayout && "h-9 min-w-9 gap-1 rounded-4xl px-2.5 py-0 text-xs",
            !isBarLayout && !isIconLayout && "h-11 min-w-[100px] px-4 py-6 text-base",
            !isReady && "cursor-not-allowed opacity-50",
          )}
        >
          {showShader ? (
            <AuroraShaderBackground
              className="rounded-[inherit]"
              targetRef={buttonShellRef}
              animate={animateShader}
              fast={fastShader}
            />
          ) : null}
          <motion.div
            layout
            transition={layoutTransition}
            className={cn(
              "relative z-10 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]",
              isBarLayout && "flex flex-row items-center justify-center gap-2",
              isIconLayout && "flex flex-row items-center justify-center gap-1",
              !isBarLayout && !isIconLayout && "flex flex-col items-center gap-0.5",
            )}
          >
            <motion.span
              layout="position"
              transition={layoutTransition}
              className={cn(
                "font-bold uppercase tracking-wide text-white",
                isIconLayout ? "inline-flex items-center" : "text-base",
              )}
            >
              {labelContent}
            </motion.span>
            {!showGeneratingState || !isIconLayout ? (
              <motion.div layout="position" transition={layoutTransition}>
                {creditContent}
              </motion.div>
            ) : null}
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
    prev.layout === next.layout &&
    prev.className === next.className
  )
}

export const GenerateShaderButton = React.memo(GenerateShaderButtonComponent, propsAreEqual)
