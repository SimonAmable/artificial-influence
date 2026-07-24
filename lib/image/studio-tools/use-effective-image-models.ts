import * as React from "react"
import { useModels } from "@/hooks/use-models"
import type { Model } from "@/lib/types/models"
import { injectStudioToolsIntoModels } from "./registry"

export function useEffectiveImageModels(): {
  models: Model[]
  isLoading: boolean
} {
  const { models: imageModels, isLoading } = useModels("image")

  const models = React.useMemo(
    () => injectStudioToolsIntoModels(imageModels),
    [imageModels],
  )

  return { models, isLoading }
}
