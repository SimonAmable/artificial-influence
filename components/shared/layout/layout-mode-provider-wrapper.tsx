"use client"

import { LayoutModeProvider } from "@/components/shared/layout/layout-mode-context"

export function LayoutModeProviderWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <LayoutModeProvider defaultMode="column">{children}</LayoutModeProvider>
}
