"use client"

import * as React from "react"
import { GearIcon, SunIcon, MoonIcon, MonitorIcon, Columns, Rows } from "@phosphor-icons/react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LayoutMode } from "@/components/shared/layout/layout-toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface SettingsDropdownProps {
  layoutMode?: LayoutMode
  onLayoutModeChange?: (mode: LayoutMode) => void
  className?: string
}

type SettingsMenuContentProps = Omit<SettingsDropdownProps, "className"> & {
  className?: string
}

const THEME_OPTIONS = [
  { value: "light", label: "Light theme", icon: SunIcon },
  { value: "dark", label: "Dark theme", icon: MoonIcon },
  { value: "system", label: "System theme", icon: MonitorIcon },
] as const

function ThemeToggleGroup({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <ToggleGroup
      type="single"
      value={theme ?? "system"}
      onValueChange={(value) => {
        if (!value) return
        setTheme(value)
      }}
      variant="outline"
      size="sm"
      className={cn("flex w-full", className)}
      aria-label="Theme"
    >
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={label}
          title={label}
          className="h-8 flex-1 rounded-full px-0"
        >
          <Icon className="size-4" weight="bold" />
          <span className="sr-only">{label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function LayoutModeToggleGroup({
  layoutMode,
  onLayoutModeChange,
}: Pick<SettingsMenuContentProps, "layoutMode" | "onLayoutModeChange">) {
  if (!layoutMode || !onLayoutModeChange) return null

  return (
    <ToggleGroup
      type="single"
      value={layoutMode}
      onValueChange={(value) => {
        if (!value) return
        onLayoutModeChange(value as LayoutMode)
      }}
      variant="outline"
      size="sm"
      className="flex w-full"
      aria-label="UI layout"
    >
      <ToggleGroupItem
        value="column"
        aria-label="Column layout"
        title="Column layout"
        className="h-8 flex-1 gap-1.5 rounded-full px-2 text-xs"
      >
        <Columns className="size-4" weight="bold" />
        <span>Column</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="row"
        aria-label="Row layout"
        title="Row layout"
        className="h-8 flex-1 gap-1.5 rounded-full px-2 text-xs"
      >
        <Rows className="size-4" weight="bold" />
        <span>Row</span>
      </ToggleGroupItem>
    </ToggleGroup>
  )
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
