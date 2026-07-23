"use client"

import type { FanvueConnectionItem } from "@/components/content/types"
import { GenerationHistoryView } from "@/components/library/history/generation-history-view"

type MediaTabProps = {
  connection: FanvueConnectionItem | null
}

export function MediaTab({ connection }: MediaTabProps) {
  return (
    <GenerationHistoryView
      actionVariant="fanvue"
      connectionId={connection?.id ?? null}
      activeConnection={connection}
      enabled
    />
  )
}
