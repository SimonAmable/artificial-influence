"use client"

import * as React from "react"
import { Sparkle } from "@phosphor-icons/react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type GenerateShaderButtonProps = {
  isReady: boolean
  isGenerating: boolean
  allowConcurrent: boolean
  onGenerate?: () => void
  creditCost: number | string
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
}: GenerateShaderButtonProps) {
  const onGenerateRef = React.useRef(onGenerate)

  onGenerateRef.current = onGenerate

  const handleGenerate = React.useCallback(() => {
    onGenerateRef.current?.()
  }, [])

  return (
    <div className="shrink-0">
      <div
        className={cn(
          "relative inline-block transition-all duration-300",
          isReady &&
            "before:absolute before:inset-[-12px] before:-z-10 before:rounded-full before:bg-[#00D3FF] before:opacity-40 before:blur-[15px] before:content-['']",
        )}
      >
        <Button
          onClick={handleGenerate}
          disabled={!isReady || (isGenerating && !allowConcurrent)}
          className={cn(
            "relative z-0 h-10 min-w-[100px] border-0 bg-black px-4 py-6 text-sm font-bold text-white shadow-none transition-all duration-300 hover:bg-black/90 dark:bg-black dark:text-white dark:hover:bg-black/90",
            !isReady && "cursor-not-allowed opacity-50",
          )}
        >
          <div className="flex flex-col items-center gap-0.5 text-white">
            <span className="text-sm font-bold text-white">Generate</span>
            <div className="flex items-center gap-0.5 font-bold text-white">
              <Sparkle size={8} weight="fill" className="text-white" />
              <AnimatedCreditCost value={creditCost} />
            </div>
          </div>
        </Button>
      </div>
    </div>
  )
}

function propsAreEqual(prev: GenerateShaderButtonProps, next: GenerateShaderButtonProps) {
  return (
    prev.isReady === next.isReady &&
    prev.isGenerating === next.isGenerating &&
    prev.allowConcurrent === next.allowConcurrent &&
    prev.creditCost === next.creditCost
  )
}

export const GenerateShaderButton = React.memo(GenerateShaderButtonComponent, propsAreEqual)
