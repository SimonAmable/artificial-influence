import type { Metadata } from "next"
import { Suspense } from "react"

import { PhotodumpTool } from "@/components/tools/photodump"

export const metadata: Metadata = {
  title: "Photodump",
  description:
    "Turn one selfie into a full photodump — different scenes, same star. Pick a preset and generate.",
}

export default function PhotodumpPage() {
  return (
    <Suspense fallback={null}>
      <PhotodumpTool />
    </Suspense>
  )
}
