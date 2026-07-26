import type { Metadata } from "next"
import { Suspense } from "react"

import { AnglesTool } from "@/components/tools/angles"

export const metadata: Metadata = {
  title: "Angles",
  description: "Move the camera around a reference image and generate a new point of view.",
}

export default function AnglesPage() {
  return (
    <Suspense fallback={null}>
      <AnglesTool />
    </Suspense>
  )
}
