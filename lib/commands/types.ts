import type { AssetType } from "@/lib/assets/types"

export type CommandTriggerMode = "slash" | "at" | null

/** Slash commands that open UI instead of pasting text */
export type SlashCommandUiAction = "create-asset" | "create-brand-kit"

export type CommandItem = {
  id: string
  label: string
  description?: string
  /** Injected into the textarea when selected (slash mode); ignored when `uiAction` is set */
  inject: string
  /** When set, `inject` is not pasted; host handles the action (e.g. open a dialog) */
  uiAction?: SlashCommandUiAction
}

export type ReferenceItem = {
  id: string
  label: string
  subtitle?: string
  category: "brand" | "asset"
  assetType?: AssetType
  /** Public URL for asset refs, used to send image assets as reference files, not only prompt text */
  assetUrl?: string
  /** Logo/icon (brand) or thumbnail (asset) for @ palette previews */
  previewUrl?: string | null
  /** Appended in buildPromptWithRefs for this reference */
  serialized: string
}

export type AttachedRef = ReferenceItem & {
  chipId: string
  /** Exact substring inserted in the prompt (e.g. `@my-brand`) for inline chips + model-visible mention */
  mentionToken: string
}
