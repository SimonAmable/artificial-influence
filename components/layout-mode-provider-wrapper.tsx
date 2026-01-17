"use client"

import { LayoutModeProvider } from "@/components/layout-mode-context"

export function LayoutModeProviderWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <LayoutModeProvider defaultMode="column">{children}</LayoutModeProvider>
}
