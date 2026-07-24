import type { Model } from "@/lib/types/models"
import { CHARACTER_SWAP_TOOL } from "./character-swap"
import { FACE_SWAP_TOOL } from "./face-swap"
import type { ImageStudioToolDefinition } from "./types"

export const IMAGE_STUDIO_TOOLS = [CHARACTER_SWAP_TOOL, FACE_SWAP_TOOL] as const

const TOOLS_BY_UI_MODEL = new Map<string, ImageStudioToolDefinition>(
  IMAGE_STUDIO_TOOLS.map((tool) => [tool.uiModelIdentifier, tool]),
)

const TOOLS_BY_ID = new Map<string, ImageStudioToolDefinition>(
  IMAGE_STUDIO_TOOLS.map((tool) => [tool.id, tool]),
)

export function getStudioToolByUiModel(identifier: string): ImageStudioToolDefinition | null {
  return TOOLS_BY_UI_MODEL.get(identifier) ?? null
}

export function getStudioToolById(id: string): ImageStudioToolDefinition | null {
  return TOOLS_BY_ID.get(id) ?? null
}

export function isStudioToolUiModel(identifier: string): boolean {
  return TOOLS_BY_UI_MODEL.has(identifier)
}

export function resolveBackendModelIdentifier(uiModelIdentifier: string): string {
  const tool = getStudioToolByUiModel(uiModelIdentifier)
  return tool?.baseModelIdentifier ?? uiModelIdentifier
}

export function injectStudioToolsIntoModels(models: Model[]): Model[] {
  if (models.length === 0) return models

  const injected: Model[] = [...models]

  for (const tool of IMAGE_STUDIO_TOOLS) {
    if (injected.some((model) => model.identifier === tool.uiModelIdentifier)) {
      continue
    }

    const baseModel = models.find((model) => model.identifier === tool.baseModelIdentifier)
    if (!baseModel) continue

    injected.push({
      ...baseModel,
      id: `ui-${tool.uiModelIdentifier}`,
      identifier: tool.uiModelIdentifier,
      name: tool.name,
      description: tool.description,
    })
  }

  return injected
}
