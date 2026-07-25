import type { ReactNode } from "react"

import { GuidesShell } from "@/components/guides/guides-shell"

export default function GuidesLayout({ children }: { children: ReactNode }) {
  return <GuidesShell>{children}</GuidesShell>
}
