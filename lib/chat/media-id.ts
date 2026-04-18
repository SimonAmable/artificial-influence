import { z } from "zod"

/** Matches raw UUID or namespaced `upl_<uuid>` / `gen_<uuid>`. */
export const mediaIdStringSchema = z
  .string()
  .regex(/^(upl_|gen_)?[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, {
    message: "Expected a UUID or upl_/gen_ prefixed media id",
  })

export type ParsedMediaId =
  | { namespace: "upload"; uuid: string }
  | { namespace: "generation"; uuid: string }
  | { namespace: "legacy"; uuid: string }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseMediaId(raw: string): ParsedMediaId {
  const trimmed = raw.trim()
  if (trimmed.startsWith("upl_")) {
    const u = trimmed.slice(4)
    if (!UUID_RE.test(u)) throw new Error(`Invalid upload media id: ${raw}`)
    return { namespace: "upload", uuid: u }
  }
  if (trimmed.startsWith("gen_")) {
    const u = trimmed.slice(4)
    if (!UUID_RE.test(u)) throw new Error(`Invalid generation media id: ${raw}`)
    return { namespace: "generation", uuid: u }
  }
  if (!UUID_RE.test(trimmed)) {
    throw new Error(`Invalid media id: ${raw}`)
  }
  return { namespace: "legacy", uuid: trimmed }
}

export function formatUploadMediaId(uuid: string): string {
  return `upl_${uuid}`
}

export function formatGenerationMediaId(uuid: string): string {
  return `gen_${uuid}`
}
