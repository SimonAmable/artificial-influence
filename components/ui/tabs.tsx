"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { LayoutGroup, motion } from "framer-motion"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const TAB_INDICATOR_TRANSITION = {
  type: "spring" as const,
  stiffness: 380,
  damping: 34,
}

const tabIndicatorClassName =
  "pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-background shadow-sm ring-1 ring-border/15"

type TabsAnimationContextValue = {
  layoutId: string
  indicatorClassName?: string
}

const TabsAnimationContext =
  React.createContext<TabsAnimationContextValue | null>(null)

function TabActiveIndicator() {
  const animation = React.useContext(TabsAnimationContext)
  const [isActive, setIsActive] = React.useState(false)
  const placeholderRef = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    const trigger = placeholderRef.current?.parentElement
    if (!trigger || !animation) return

    const sync = () => {
      const state = trigger.getAttribute("data-state")
      const active = trigger.getAttribute("data-active")
      setIsActive(state === "active" || active !== null)
    }
    sync()

    const observer = new MutationObserver(sync)
    observer.observe(trigger, {
      attributes: true,
      attributeFilter: ["data-state", "data-active"],
    })
    return () => observer.disconnect()
  }, [animation])

  if (!animation) return null

  return (
    <>
      <span ref={placeholderRef} className="sr-only" aria-hidden />
      {isActive ? (
        <motion.div
          layoutId={animation.layoutId}
          className={cn(tabIndicatorClassName, animation.indicatorClassName)}
          transition={TAB_INDICATOR_TRANSITION}
        />
      ) : null}
    </>
  )
}

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "gap-2 group/tabs flex data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group-data-horizontal/tabs:min-h-9 group-data-vertical/tabs:rounded-2xl data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "rounded-full p-0.5 bg-muted/60",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  indicatorClassName,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants> & {
    indicatorClassName?: string
  }) {
  const layoutId = React.useId()
  const isAnimated = variant !== "line"

  const list = (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {isAnimated ? (
        <TabsAnimationContext.Provider
          value={{ layoutId, indicatorClassName }}
        >
          {children}
        </TabsAnimationContext.Provider>
      ) : (
        children
      )}
    </TabsPrimitive.List>
  )

  if (!isAnimated) return list

  return <LayoutGroup>{list}</LayoutGroup>
}

function TabsTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const animation = React.useContext(TabsAnimationContext)

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-transparent px-3 py-1.5 text-sm font-medium text-foreground/60 transition-[color,box-shadow] hover:text-foreground focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start group-data-[variant=line]/tabs-list:rounded-none group-data-vertical/tabs:px-2.5 group-data-vertical/tabs:py-1.5 dark:text-muted-foreground dark:hover:text-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        !animation &&
          "transition-all data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        animation &&
          "bg-transparent data-active:bg-transparent! data-active:text-foreground! data-active:shadow-none! dark:data-active:bg-transparent!",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    >
      {animation ? (
        <>
          <TabActiveIndicator />
          <span className="relative z-1 inline-flex items-center gap-[inherit]">
            {children}
          </span>
        </>
      ) : (
        children
      )}
    </TabsPrimitive.Trigger>
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
