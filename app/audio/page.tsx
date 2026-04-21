"use client"

import * as React from "react"
import { Suspense } from "react"

import { AudioStudioPage } from "@/components/tools/audio"

function AudioPageContent() {
  return <AudioStudioPage />
}

export default function AudioPage() {
  return (
    <Suspense fallback={null}>
      <AudioPageContent />
    </Suspense>
  )
}
