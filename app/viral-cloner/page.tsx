import type { Metadata } from "next"
import { Suspense } from "react"

import { ViralClonerTool } from "@/components/tools/viral-cloner"

export const metadata: Metadata = {
  title: "Viral Cloner",
  description: "Clone public social posts onto your reference character with upfront pricing.",
}

export default function ViralClonerPage() {
  return (
    <Suspense fallback={null}>
      <ViralClonerTool />
    </Suspense>
  )
}