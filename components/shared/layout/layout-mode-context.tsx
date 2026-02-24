"use client"

import * as React from "react"
import { LayoutMode } from "@/components/shared/layout/layout-toggle"

interface LayoutModeContextType {
  layoutMode: LayoutMode
  setLayoutMode: (mode: LayoutMode) => void
}

const LayoutModeContext = React.createContext<LayoutModeContextType | undefined>(undefined)

const STORAGE_KEY = "layout-mode"

export function LayoutModeProvider({
  children,
  defaultMode = "row",
}: {
  children: React.ReactNode
  defaultMode?: LayoutMode
}) {
  // Initialize with defaultMode to avoid hydration mismatch
  // The actual value will be loaded from localStorage in useEffect
  const [layoutMode, setLayoutModeState] = React.useState<LayoutMode>(defaultMode)
  const [isMounted, setIsMounted] = React.useState(false)

  // Load from localStorage on mount (client-side only)
  React.useEffect(() => {
    setIsMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY) as LayoutMode | null
    if (stored && (stored === "column" || stored === "row")) {
      setLayoutModeState(stored)
    }
  }, [])

  // Save to localStorage whenever layoutMode changes
  React.useEffect(() => {
    if (isMounted) {
      localStorage.setItem(STORAGE_KEY, layoutMode)
    }
  }, [layoutMode, isMounted])

  const setLayoutMode = React.useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode)
  }, [])

  return (
    <LayoutModeContext.Provider value={{ layoutMode, setLayoutMode }}>
      {children}
    </LayoutModeContext.Provider>
  )
}

export function useLayoutMode() {
  const context = React.useContext(LayoutModeContext)
  return context
}
