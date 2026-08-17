import type { StudioBoardFields } from "@/lib/studio/types"
import { offsetStudioBoardFields } from "@/lib/studio/placement"

function parseFiniteNumber(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || !raw.trim()) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

/**
 * Read optional Studio board placement from generate-image FormData.
 * Returns null when studioProjectId is missing/invalid.
 */
export function parseStudioBoardFieldsFromFormData(
  formData: FormData,
): StudioBoardFields | null {
  const projectId = formData.get("studioProjectId")
  if (typeof projectId !== "string" || !projectId.trim()) {
    return null
  }

  const studioX = parseFiniteNumber(formData.get("studioX"))
  const studioY = parseFiniteNumber(formData.get("studioY"))
  const studioWidth = parseFiniteNumber(formData.get("studioWidth"))
  const studioHeight = parseFiniteNumber(formData.get("studioHeight"))

  if (
    studioX == null ||
    studioY == null ||
    studioWidth == null ||
    studioHeight == null ||
    studioWidth <= 0 ||
    studioHeight <= 0
  ) {
    return null
  }

  return {
    studio_project_id: projectId.trim(),
    studio_x: studioX,
    studio_y: studioY,
    studio_width: studioWidth,
    studio_height: studioHeight,
  }
}

export function studioBoardFieldsForIndex(
  base: StudioBoardFields | null,
  index: number,
): StudioBoardFields | Record<string, never> {
  if (!base) return {}
  return offsetStudioBoardFields(base, index)
}

export function appendStudioBoardFieldsToFormData(
  formData: FormData,
  fields: StudioBoardFields,
) {
  formData.append("studioProjectId", fields.studio_project_id)
  formData.append("studioX", String(fields.studio_x))
  formData.append("studioY", String(fields.studio_y))
  formData.append("studioWidth", String(fields.studio_width))
  formData.append("studioHeight", String(fields.studio_height))
}
