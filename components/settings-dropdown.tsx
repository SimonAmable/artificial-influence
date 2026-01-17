"use client"

import * as React from "react"
import { GearIcon, SunIcon, MoonIcon, MonitorIcon, Columns, Rows } from "@phosphor-icons/react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LayoutMode } from "@/components/layout-toggle"

interface SettingsDropdownProps {
  layoutMode?: LayoutMode
  onLayoutModeChange?: (mode: LayoutMode) => void
  className?: string
}

export function SettingsDropdown({
  layoutMode,
  onLayoutModeChange,
  className,
}: SettingsDropdownProps) {
  const { theme, setTheme } = useTheme()
  const showLayoutOptions = layoutMode !== undefined && onLayoutModeChange !== undefined

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className={className}>
          <GearIcon className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <SunIcon className="mr-2 h-4 w-4" />
            <span>Light</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon className="mr-2 h-4 w-4" />
            <span>Dark</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <MonitorIcon className="mr-2 h-4 w-4" />
            <span>System</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {showLayoutOptions && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>UI Layout</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={layoutMode} onValueChange={onLayoutModeChange}>
              <DropdownMenuRadioItem value="column">
                <Columns className="mr-2 h-4 w-4" />
                <span>Column</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="row">
                <Rows className="mr-2 h-4 w-4" />
                <span>Row</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
