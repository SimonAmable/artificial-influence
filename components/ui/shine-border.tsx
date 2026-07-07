"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface ShineBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Width of the border in pixels
   * @default 1
   */
  borderWidth?: number
  /**
   * Duration of the animation in seconds
   * @default 14
   */
  duration?: number
  /**
   * Color of the border, can be a single color or an array of colors
   * @default "#000000"
   */
  shineColor?: string | string[]
  /**
   * Opacity of the blurred glow layer
   * @default 0.85
   */
  glowOpacity?: number
  /**
   * Blur radius of the glow layer in pixels
   * @default 12
   */
  glowBlur?: number
}

/**
 * Shine Border
 *
 * An animated background border effect component with configurable properties.
 */
export function ShineBorder({
  borderWidth = 1,
  duration = 14,
  shineColor = "#000000",
  glowOpacity = 0.85,
  glowBlur = 12,
  className,
  style,
  ...props
}: ShineBorderProps) {
  const commonStyles = {
    "--border-width": `${borderWidth}px`,
    "--duration": `${duration}s`,
    backgroundImage: `radial-gradient(transparent,transparent, ${
      Array.isArray(shineColor) ? shineColor.join(",") : shineColor
    },transparent,transparent)`,
    backgroundSize: "300% 300%",
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 size-full rounded-[inherit]",
        className
      )}
      style={style}
      {...props}
    >
      {/* Blurred dynamic glow layer */}
      <div
        style={
          {
            ...commonStyles,
            filter: `blur(${glowBlur}px)`,
            opacity: glowOpacity,
          } as React.CSSProperties
        }
        className="motion-safe:animate-shine pointer-events-none absolute inset-0 size-full rounded-[inherit] will-change-[background-position]"
      />
      {/* Sharp border outline */}
      <div
        style={
          {
            ...commonStyles,
            mask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
            WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            padding: "var(--border-width)",
          } as React.CSSProperties
        }
        className="motion-safe:animate-shine pointer-events-none absolute inset-0 size-full rounded-[inherit] will-change-[background-position]"
      />
    </div>
  )
}
