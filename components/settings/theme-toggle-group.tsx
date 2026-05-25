"use client"

import { MoonIcon, MonitorIcon, SunIcon } from "@phosphor-icons/react"
import { useTheme } from "next-themes"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

const THEME_OPTIONS = [
  { value: "light", label: "Light theme", icon: SunIcon },
  { value: "dark", label: "Dark theme", icon: MoonIcon },
  { value: "system", label: "System theme", icon: MonitorIcon },
] as const

export function ThemeToggleGroup({ className }: { className?: string }) {
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
