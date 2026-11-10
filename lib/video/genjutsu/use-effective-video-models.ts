"use client"

import * as React from "react"
import { useModels } from "@/hooks/use-models"
import type { Model } from "@/lib/types/models"
import { injectGenjutsuIntoVideoModels } from "./inject"

export function useEffectiveVideoModels(): {
  models: Model[]
  isLoading: boolean
} {
  const { models: videoModels, isLoading } = useModels("video")
  const models = React.useMemo(
    () => injectGenjutsuIntoVideoModels(videoModels),
    [videoModels],
  )
  return { models, isLoading }
}
