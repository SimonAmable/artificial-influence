"use client"

import * as React from "react"

import { useGuideProgress } from "@/components/guides/use-guide-progress"

/** Marks a guide complete on open (short guides: open = done). */
export function GuideMarkComplete({ slug }: { slug: string }) {
  const { markComplete } = useGuideProgress()

  React.useEffect(() => {
    markComplete(slug)
  }, [markComplete, slug])

  return null
}
