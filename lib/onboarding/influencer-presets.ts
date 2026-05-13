/**
 * Curated preset characters shown on the onboarding "Create AI influencer"
 * sub-step. Thumbnails live in `/public/sample_influencers/` and are referenced
 * here as public paths.
 *
 * Picked entries are stored on `onboarding_json_data.aiInfluencer.presetId`.
 */
export type InfluencerPreset = {
  id: string
  name: string
  description: string
  /** Public path under `/public` or an absolute URL. */
  thumbnailUrl?: string
  /** Public path under `/public` or an absolute URL. Plays on hover/selection if provided. */
  previewVideoUrl?: string
  /** Tailwind gradient classes used as a fallback when no thumbnail is available. */
  gradientClassName?: string
}

export const INFLUENCER_PRESETS: readonly InfluencerPreset[] = [
  {
    id: "aria",
    name: "Aria",
    description: "Lifestyle storyteller",
    thumbnailUrl: "/sample_influencers/female_lifestyle.png",
    gradientClassName: "from-rose-400/60 via-pink-500/40 to-fuchsia-600/30",
  },
  {
    id: "iris",
    name: "Iris",
    description: "Beauty & skincare muse",
    thumbnailUrl: "/sample_influencers/female_beauty.png",
    gradientClassName: "from-amber-300/60 via-orange-500/40 to-rose-600/30",
  },
  {
    id: "nova",
    name: "Nova",
    description: "ABG CMO",
    thumbnailUrl: "/sample_influencers/female_tech.png",
    gradientClassName: "from-sky-400/60 via-blue-500/40 to-indigo-600/30",
  },
  {
    id: "mira",
    name: "Mira",
    description: "Everyday creator",
    thumbnailUrl: "/sample_influencers/female.png",
    gradientClassName: "from-violet-400/60 via-purple-500/40 to-indigo-600/30",
  },
  {
    id: "kai",
    name: "Kai",
    description: "Fashion & street style",
    thumbnailUrl: "/sample_influencers/male_fashion.png",
    gradientClassName: "from-emerald-400/60 via-teal-500/40 to-cyan-600/30",
  },
  {
    id: "lex",
    name: "Lex",
    description: "Tech & gear reviewer",
    thumbnailUrl: "/sample_influencers/male_tech.png",
    gradientClassName: "from-zinc-500/60 via-slate-600/40 to-neutral-800/30",
  },
] as const

export function findInfluencerPreset(id: string | null | undefined): InfluencerPreset | undefined {
  if (!id) return undefined
  return INFLUENCER_PRESETS.find((p) => p.id === id)
}
