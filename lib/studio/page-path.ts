import { tileSizeForAspectRatio } from "@/lib/studio/placement"
import type { StudioBoardFields } from "@/lib/studio/types"

const STUDIO_PROJECT_PATH =
  /^\/studio\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i

export function parseStudioProjectIdFromPagePath(
  pagePath?: string | null,
): string | null {
  if (!pagePath) return null
  const match = pagePath.match(STUDIO_PROJECT_PATH)
  return match?.[1] ?? null
}

export function defaultStudioBoardFields(
  projectId: string,
  kind: "image" | "video" = "image",
): StudioBoardFields {
  const size = tileSizeForAspectRatio(kind === "video" ? "16:9" : "1:1")
  return {
    studio_project_id: projectId,
    studio_x: 0,
    studio_y: 0,
    studio_width: size.width,
    studio_height: size.height,
  }
}

export function studioBoardFieldsFromPagePath(
  pagePath: string | undefined,
  kind: "image" | "video" = "image",
): StudioBoardFields | null {
  const projectId = parseStudioProjectIdFromPagePath(pagePath)
  if (!projectId) return null
  return defaultStudioBoardFields(projectId, kind)
}
