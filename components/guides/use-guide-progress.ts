"use client"

import * as React from "react"

import {
  GUIDE_PROGRESS_EVENT,
  GUIDE_PROGRESS_STORAGE_KEY,
  markGuideComplete,
  readCompletedGuides,
} from "@/lib/guides/progress"

export function useGuideProgress() {
  const [completed, setCompleted] = React.useState<ReadonlySet<string>>(() => new Set())
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    const sync = () => {
      setCompleted(new Set(readCompletedGuides()))
      setReady(true)
    }

    sync()

    const onStorage = (event: StorageEvent) => {
      if (event.key === GUIDE_PROGRESS_STORAGE_KEY || event.key === null) {
        sync()
      }
    }

    window.addEventListener(GUIDE_PROGRESS_EVENT, sync)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(GUIDE_PROGRESS_EVENT, sync)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const markComplete = React.useCallback((slug: string) => {
    const next = markGuideComplete(slug)
    setCompleted(new Set(next))
    setReady(true)
  }, [])

  const isComplete = React.useCallback(
    (slug: string) => completed.has(slug),
    [completed],
  )

  return {
    completed,
    ready,
    markComplete,
    isComplete,
  }
}
