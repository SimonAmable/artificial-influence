import type { UIMessage } from "ai"
import { humanizeToolPartType } from "@/components/chat/tool-ui/message-helpers"

/** Collapsible trace UI groups (Chain of Thought), by theme. */
export const TRACE_COT_TOOLS = {
  assets: [
    "tool-searchAssets",
    "tool-listRecentGenerations",
    "tool-listThreadMedia",
    "tool-saveGenerationAsAsset",
  ],
  research: [
    "tool-searchWeb",
    "tool-readWebPage",
    "tool-searchWebImages",
    "tool-searchStockReferences",
    "tool-capturePageScreenshot",
  ],
  catalog: ["tool-listModels", "tool-searchModels", "tool-searchVoices"],
  social: ["tool-listSocialConnections", "tool-listInstagramConnections"],
  brand: ["tool-getBrandContext", "tool-listAutomations"],
} as const

export type TraceCotCategory = keyof typeof TRACE_COT_TOOLS

const TOOL_TYPE_TO_CATEGORY = new Map<string, TraceCotCategory>(
  (Object.entries(TRACE_COT_TOOLS) as [TraceCotCategory, readonly string[]][]).flatMap(
    ([category, types]) => types.map((type) => [type, category] as const),
  ),
)

export const TRACE_COT_TOOL_TYPES = new Set<string>(
  Object.values(TRACE_COT_TOOLS).flat(),
)

const APPROVAL_STATES = new Set([
  "approval-requested",
  "approval-responded",
  "output-denied",
])

type ToolPartLike = {
  type: string
  state?: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
}

export type TraceToolStepMeta = {
  label: string
  description?: string
  status: "complete" | "active" | "pending"
}

export type MessagePartSegment =
  | { kind: "single"; index: number }
  | { kind: "tool-trace-cot"; category: TraceCotCategory; indices: number[] }

export function getTraceCotCategory(toolType: string): TraceCotCategory | null {
  return TOOL_TYPE_TO_CATEGORY.get(toolType) ?? null
}

export function isTraceCotToolPart(part: UIMessage["parts"][number]): boolean {
  if (!TRACE_COT_TOOL_TYPES.has(part.type)) return false
  const state = (part as ToolPartLike).state
  if (state && APPROVAL_STATES.has(state)) return false
  return true
}

export function isTraceCotToolActive(part: UIMessage["parts"][number]): boolean {
  if (!isTraceCotToolPart(part)) return false
  const state = (part as ToolPartLike).state
  return state === "input-streaming" || state === "input-available"
}

export function traceCotGroupIsActive(parts: UIMessage["parts"], indices: number[]): boolean {
  return indices.some((index) => isTraceCotToolActive(parts[index]))
}

export function getTraceCotGroupHeader(
  category: TraceCotCategory,
  isActive: boolean,
): string {
  const labels: Record<TraceCotCategory, { active: string; done: string }> = {
    assets: { active: "Looking through assets…", done: "Checked assets" },
    research: { active: "Researching…", done: "Researched" },
    catalog: { active: "Browsing models & voices…", done: "Checked catalog" },
    social: { active: "Checking connected accounts…", done: "Checked accounts" },
    brand: { active: "Loading brand & automations…", done: "Checked brand setup" },
  }
  return isActive ? labels[category].active : labels[category].done
}

function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

function truncateQuery(value: unknown, max = 48): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`
}

function hostnameFromUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return undefined
  }
}

export function getTraceToolStepMeta(part: UIMessage["parts"][number]): TraceToolStepMeta {
  const tool = part as ToolPartLike
  const state = tool.state
  const status: TraceToolStepMeta["status"] =
    state === "input-streaming" || state === "input-available" ? "active" : "complete"

  const total = typeof tool.output?.total === "number" ? tool.output.total : undefined
  const count = typeof tool.output?.count === "number" ? tool.output.count : undefined
  const countDescription =
    total !== undefined
      ? formatCount(total, "result")
      : count !== undefined
        ? formatCount(count, "item")
        : undefined

  switch (tool.type) {
    case "tool-searchAssets":
      return {
        label: "Searching assets",
        description: countDescription ?? truncateQuery(tool.input?.query),
        status,
      }
    case "tool-listRecentGenerations":
      return {
        label: "Recent generations",
        description: countDescription,
        status,
      }
    case "tool-listThreadMedia":
      return {
        label: "Thread media",
        description: countDescription,
        status,
      }
    case "tool-saveGenerationAsAsset": {
      const asset = tool.output?.asset as { title?: string } | undefined
      return {
        label: "Save as asset",
        description:
          typeof asset?.title === "string"
            ? asset.title
            : tool.output?.alreadySaved
              ? "Already saved"
              : undefined,
        status,
      }
    }
    case "tool-searchWeb":
      return {
        label: "Web search",
        description: countDescription ?? truncateQuery(tool.input?.query ?? tool.output?.query),
        status,
      }
    case "tool-readWebPage":
      return {
        label: "Read web page",
        description:
          hostnameFromUrl(tool.output?.page && (tool.output.page as { finalUrl?: string }).finalUrl) ??
          hostnameFromUrl(tool.input?.url),
        status,
      }
    case "tool-searchWebImages":
      return {
        label: "Web image search",
        description:
          countDescription ??
          truncateQuery(tool.input?.query ?? tool.output?.query),
        status,
      }
    case "tool-searchStockReferences":
      return {
        label: "Stock references",
        description:
          countDescription ??
          truncateQuery(tool.input?.query ?? tool.output?.query),
        status,
      }
    case "tool-capturePageScreenshot":
      return {
        label: "Page screenshot",
        description:
          hostnameFromUrl(
            tool.output?.screenshot && (tool.output.screenshot as { sourceUrl?: string }).sourceUrl,
          ) ?? hostnameFromUrl(tool.input?.url),
        status,
      }
    case "tool-listModels":
      return {
        label: "List models",
        description:
          Array.isArray(tool.output?.models)
            ? formatCount(tool.output.models.length, "model")
            : countDescription,
        status,
      }
    case "tool-searchModels":
      return {
        label: "Search models",
        description:
          Array.isArray(tool.output?.models)
            ? formatCount(tool.output.models.length, "model")
            : countDescription,
        status,
      }
    case "tool-searchVoices":
      return {
        label: "Search voices",
        description:
          countDescription ??
          truncateQuery(tool.input?.query ?? tool.output?.query),
        status,
      }
    case "tool-listSocialConnections":
      return {
        label: "Social accounts",
        description: countDescription,
        status,
      }
    case "tool-listInstagramConnections":
      return {
        label: "Instagram accounts",
        description: countDescription,
        status,
      }
    case "tool-getBrandContext": {
      const brand = tool.output?.brand as { name?: string } | undefined
      const brands = tool.output?.availableBrands
      return {
        label: "Brand context",
        description:
          typeof brand?.name === "string"
            ? brand.name
            : Array.isArray(brands)
              ? formatCount(brands.length, "brand")
              : truncateQuery(tool.input?.brandName),
        status,
      }
    }
    case "tool-listAutomations":
      return {
        label: "Automations",
        description:
          Array.isArray(tool.output?.automations)
            ? formatCount(tool.output.automations.length, "automation")
            : countDescription,
        status,
      }
    default:
      return {
        label: humanizeToolPartType(tool.type),
        description: countDescription,
        status,
      }
  }
}

export function segmentMessagePartsForTraceCot(parts: UIMessage["parts"]): MessagePartSegment[] {
  const segments: MessagePartSegment[] = []
  let bufferIndices: number[] = []
  let bufferCategory: TraceCotCategory | null = null

  const flushBuffer = () => {
    if (bufferIndices.length === 0 || bufferCategory === null) return
    segments.push({
      kind: "tool-trace-cot",
      category: bufferCategory,
      indices: [...bufferIndices],
    })
    bufferIndices = []
    bufferCategory = null
  }

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]

    if (isTraceCotToolPart(part)) {
      const category = getTraceCotCategory(part.type)
      if (!category) {
        flushBuffer()
        segments.push({ kind: "single", index })
        continue
      }

      if (bufferCategory !== null && category !== bufferCategory) {
        flushBuffer()
      }

      bufferCategory = category
      bufferIndices.push(index)
      continue
    }

    flushBuffer()
    segments.push({ kind: "single", index })
  }

  flushBuffer()
  return segments
}
