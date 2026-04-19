"use client"

import { cn } from "@/lib/utils"
import type { ComponentPropsWithoutRef, CSSProperties, ElementType } from "react"

type ShimmerProps<T extends ElementType = "p"> = {
  as?: T
  children: string
  className?: string
  duration?: number
  spread?: number
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">

export const Shimmer = <T extends ElementType = "p">({
  as,
  children,
  className,
  duration = 2,
  spread = 2,
  style,
  ...props
}: ShimmerProps<T>) => {
  const Component = (as ?? "p") as ElementType
  const shimmerSpread = `${Math.max(children.length * spread, 8)}ch`

  const shimmerStyle = {
    ...style,
    animation: "ai-elements-shimmer var(--shimmer-duration) linear infinite",
    // Theme tokens are full colors (e.g. oklch(...)), not HSL components, use them directly.
    backgroundImage:
      "linear-gradient(110deg, color-mix(in oklch, var(--muted-foreground) 55%, var(--background)) 38%, var(--foreground) 50%, color-mix(in oklch, var(--muted-foreground) 55%, var(--background)) 62%)",
    backgroundSize: "var(--shimmer-spread) 100%",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
    ["--shimmer-duration" as string]: `${duration}s`,
    ["--shimmer-spread" as string]: shimmerSpread,
  } as CSSProperties

  return (
    <>
      <Component
        className={cn("inline-block bg-no-repeat font-medium", className)}
        style={shimmerStyle}
        {...props}
      >
        {children}
      </Component>
      <style jsx global>{`
        @keyframes ai-elements-shimmer {
          from {
            background-position: calc(var(--shimmer-spread) * -1) 0;
          }
          to {
            background-position: var(--shimmer-spread) 0;
          }
        }
      `}</style>
    </>
  )
}
