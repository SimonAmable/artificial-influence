"use client"

import { GearIcon } from "@phosphor-icons/react"

import { LayoutModeToggleGroup } from "@/components/settings/layout-mode-toggle-group"
import { ThemeToggleGroup } from "@/components/settings/theme-toggle-group"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LayoutMode } from "@/components/shared/layout/layout-toggle"

interface SettingsDropdownProps {
  layoutMode?: LayoutMode
  onLayoutModeChange?: (mode: LayoutMode) => void
  className?: string
}

type SettingsMenuContentProps = Omit<SettingsDropdownProps, "className"> & {
  className?: string
}

export function SettingsMenuContent({
  layoutMode,
  onLayoutModeChange,
  className,
}: SettingsMenuContentProps) {
  const showLayoutOptions = layoutMode !== undefined && onLayoutModeChange !== undefined

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        <p className="px-1 text-xs font-medium text-muted-foreground">Theme</p>
        <ThemeToggleGroup />
      </div>
      {showLayoutOptions ? (
        <div className="space-y-2 border-t border-border/80 pt-3">
          <p className="px-1 text-xs font-medium text-muted-foreground">UI Layout</p>
          <LayoutModeToggleGroup
            layoutMode={layoutMode}
            onLayoutModeChange={onLayoutModeChange}
          />
        </div>
      ) : null}
    </div>
  )
}

export function SettingsDropdown({
  layoutMode,
  onLayoutModeChange,
  className,
}: SettingsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn("shadow-md", className)}
        >
          <GearIcon className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-3">
        <SettingsMenuContent
          layoutMode={layoutMode}
          onLayoutModeChange={onLayoutModeChange}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
