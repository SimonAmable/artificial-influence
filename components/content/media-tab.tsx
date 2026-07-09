"use client"

import { GenerationHistoryView } from "@/components/library/history/generation-history-view"

type MediaTabProps = {
  connectionId: string | null
}

export function MediaTab({ connectionId }: MediaTabProps) {
  return <GenerationHistoryView actionVariant="fanvue" connectionId={connectionId} enabled />
}
