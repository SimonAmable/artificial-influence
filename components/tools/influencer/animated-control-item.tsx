"use client"

import * as React from "react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion"
import { cn } from "@/lib/utils"

const LAYOUT_EASE = [0.22, 1, 0.36, 1] as const
const EXIT_EASE = [0.4, 0, 0.72, 0] as const

export const influencerControlPillClassName =
  "h-9 min-h-9 shrink-0 text-xs w-fit min-w-0 px-2.5 rounded-4xl border border-input bg-input/30 hover:bg-input/50 dark:hover:bg-input/50"

export const influencerControlIconButtonClassName = cn(
  influencerControlPillClassName,
  "w-9 min-w-9 justify-center p-0",
)

export function getControlLayoutTransition(prefersReducedMotion: boolean | null): Transition {
  if (prefersReducedMotion) {
    return { duration: 0 }
  }

  return {
    type: "spring",
    stiffness: 520,
    damping: 38,
    mass: 0.75,
  }
}

function getAppearTransition(prefersReducedMotion: boolean | null): Transition {
  return prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: LAYOUT_EASE }
}

function getExitTransition(prefersReducedMotion: boolean | null): Transition {
  return prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.16, ease: EXIT_EASE }
}

type AnimatedControlItemProps = {
  className?: string
  children: React.ReactNode
  /** Animate enter/exit when used inside AnimatePresence */
  appear?: boolean
}

export function AnimatedControlItem({
  className,
  children,
  appear = false,
}: AnimatedControlItemProps) {
  const prefersReducedMotion = useReducedMotion()
  const layoutTransition = getControlLayoutTransition(prefersReducedMotion)
  const appearTransition = getAppearTransition(prefersReducedMotion)
  const exitTransition = getExitTransition(prefersReducedMotion)

  return (
    <motion.div
      layout
      initial={
        appear
          ? prefersReducedMotion
            ? { opacity: 0 }
            : { opacity: 0, scale: 0.9, x: -8, filter: "blur(4px)" }
          : false
      }
      animate={
        prefersReducedMotion
          ? { opacity: 1 }
          : { opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }
      }
      exit={
        appear
          ? prefersReducedMotion
            ? { opacity: 0, transition: exitTransition }
            : {
                opacity: 0,
                scale: 0.9,
                x: -8,
                filter: "blur(4px)",
                transition: exitTransition,
              }
          : undefined
      }
      transition={{
        layout: layoutTransition,
        opacity: appearTransition,
        scale: appearTransition,
        x: appearTransition,
        filter: appearTransition,
      }}
      className={cn("shrink-0", className)}
    >
      <motion.div layout="size" transition={{ layout: layoutTransition }} className="min-w-0">
        {children}
      </motion.div>
    </motion.div>
  )
}

type AnimatedSelectLabelProps = {
  value: React.ReactNode
  className?: string
}

/** Smooth width + content transitions inside compact select triggers. */
export function AnimatedSelectLabel({ value, className }: AnimatedSelectLabelProps) {
  const prefersReducedMotion = useReducedMotion()
  const layoutTransition = getControlLayoutTransition(prefersReducedMotion)
  const contentTransition = getAppearTransition(prefersReducedMotion)
  const displayValue = String(value)

  return (
    <motion.span layout transition={{ layout: layoutTransition }} className="relative inline-grid overflow-hidden">
      <span
        aria-hidden
        className={cn("invisible col-start-1 row-start-1 whitespace-nowrap", className)}
      >
        {displayValue}
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={displayValue}
          layout
          initial={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, y: "100%" }
          }
          animate={
            prefersReducedMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0 }
          }
          exit={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, y: "-100%" }
          }
          transition={{
            layout: layoutTransition,
            ...contentTransition,
          }}
          className={cn("col-start-1 row-start-1 whitespace-nowrap", className)}
        >
          {displayValue}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
}

export const influencerControlsPresenceProps = {
  initial: false,
  mode: "popLayout" as const,
}
