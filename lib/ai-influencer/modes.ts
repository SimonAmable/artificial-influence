export const INFLUENCER_CREATION_MODES = ["direct", "merge", "build"] as const

export type InfluencerCreationMode = (typeof INFLUENCER_CREATION_MODES)[number]

export type InfluencerModeCopy = {
  id: InfluencerCreationMode
  /** Short tab label */
  tabLabel: string
  /** Full product name used in help + guides */
  title: string
  /** One-line when-to-use */
  summary: string
  /** Longer explanation for help modal / guide */
  description: string
  whenToUse: string
  whatYouNeed: string
  creditNote: string
  emptyStateTitle: string
  emptyStateHint: string
}

export const INFLUENCER_MODE_COPY: Record<InfluencerCreationMode, InfluencerModeCopy> = {
  direct: {
    id: "direct",
    tabLabel: "Direct Save",
    title: "Direct Save Mode",
    summary: "Save a character from one photo.",
    description:
      "Upload exactly one photo of a character you already have, name them, and save them directly to your library.",
    whenToUse: "You already have a face you want to keep.",
    whatYouNeed: "1 clear face photo",
    creditNote: "Free — 0 credits",
    emptyStateTitle: "Add 1 reference photo",
    emptyStateHint: "Upload one photo to save it as a reusable character.",
  },
  merge: {
    id: "merge",
    tabLabel: "Merge",
    title: "Merge References Mode",
    summary: "Blend 2–3 faces into one identity.",
    description:
      "Upload 2 or 3 closeups of different faces. We will blend and merge their facial structures into one consistent face.",
    whenToUse: "You want a hybrid look from a few references.",
    whatYouNeed: "2–3 face closeups",
    creditNote: "Uses credits (GPT Image 2)",
    emptyStateTitle: "Add 2–3 reference photos",
    emptyStateHint: "Upload closeups to blend into one new face.",
  },
  build: {
    id: "build",
    tabLabel: "Build",
    title: "Build from Traits Mode",
    summary: "Generate a new face from traits.",
    description:
      "No reference photos? Select gender, race, eye color, hair, and style in the Builder. We will generate a new character.",
    whenToUse: "You’re starting from scratch.",
    whatYouNeed: "Trait picks in the Builder",
    creditNote: "Uses credits (GPT Image 2)",
    emptyStateTitle: "Build with the Builder",
    emptyStateHint: "Pick traits in the Builder panel, then create your character.",
  },
}

export function parseInfluencerCreationMode(
  value: string | null | undefined,
): InfluencerCreationMode | null {
  switch (value) {
    case "direct":
    case "upload":
      return "direct"
    case "merge":
      return "merge"
    case "build":
      return "build"
    case null:
    case undefined:
    case "":
      return null
    default:
      return null
  }
}

export function influencerModeHref(
  mode: InfluencerCreationMode,
  options?: { help?: boolean },
): string {
  const params = new URLSearchParams()
  params.set("mode", mode)
  if (options?.help) params.set("help", "1")
  return `/ai-influencer?${params.toString()}`
}

export function getInfluencerModeCopy(mode: InfluencerCreationMode): InfluencerModeCopy {
  return INFLUENCER_MODE_COPY[mode]
}

/** Ordered list for tabs, help modal, and guide chooser. */
export const INFLUENCER_MODE_LIST: InfluencerModeCopy[] = INFLUENCER_CREATION_MODES.map(
  (mode) => INFLUENCER_MODE_COPY[mode],
)

export function assertNeverInfluencerMode(mode: never): never {
  throw new Error(`Unhandled influencer mode: ${String(mode)}`)
}

/** Product-agnostic help subtitle. */
export function influencerHelpSubtitle(productName: string): string {
  return `${productName} lets you create and save consistent AI characters in three modes.`
}

export type InfluencerGuidePath = {
  mode: InfluencerCreationMode
  title: string
  whenToUse: string
  whatYouNeed: string
  creditNote: string
  ctaLabel: string
  ctaHref: string
}

export function getInfluencerGuidePaths(): InfluencerGuidePath[] {
  return INFLUENCER_MODE_LIST.map((mode) => ({
    mode: mode.id,
    title: mode.title,
    whenToUse: mode.whenToUse,
    whatYouNeed: mode.whatYouNeed,
    creditNote: mode.creditNote,
    ctaLabel: `Open ${mode.tabLabel}`,
    ctaHref: influencerModeHref(mode.id),
  }))
}
