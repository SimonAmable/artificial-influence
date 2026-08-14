/** Blur tail rotates per shot so the dump feels like multiple casual phone pics. */
const INFLUENCER_CANDID_BLUR_VARIANTS = [
  "slightly blurry",
  "a little blurry",
  "slightly soft",
  "minor motion blur",
] as const

/** Stable amateur-phone anchor shared across influencer packs. */
export function getInfluencerCandidCameraPrefix(shotIndex: number): string {
  const blur =
    INFLUENCER_CANDID_BLUR_VARIANTS[shotIndex % INFLUENCER_CANDID_BLUR_VARIANTS.length]
  return `Candid, amateur image, badly framed, low light, grainy, iPhone 12 camera quality, unposed, ${blur}.`
}

export function buildPhotodumpShotPrompt(options: {
  shotBrief: string
  shotIndex: number
  shotCount: number
  note?: string | null
  usesAestheticReferences: boolean
  influencerCandid?: boolean
}): string {
  const note = options.note?.trim()
  const qualityLine = options.influencerCandid
    ? "Authentic casual phone-camera photodump vibe, imperfect framing, natural grain, not studio-polished."
    : "Photorealistic, sharp, natural skin texture, Instagram-ready photodump quality."

  return [
    "Create a single photorealistic social-media portrait using the provided subject reference photo.",
    `This is shot ${options.shotIndex + 1} of ${options.shotCount} in a cohesive photodump series.`,
    "Preserve the same person identity, face, hairstyle, skin tone, age, and body proportions across every shot.",
    "Change the environment, lighting, wardrobe styling, color grade, and camera mood to match the shot brief.",
    options.shotBrief,
    options.usesAestheticReferences
      ? "Also match the aesthetic reference images for lighting, palette, wardrobe vibe, and location mood — never copy another person's identity from those references."
      : null,
    note ? `User note to honor when possible: ${note}` : null,
    qualityLine,
  ]
    .filter(Boolean)
    .join(" ")
}
