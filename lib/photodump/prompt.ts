export function buildPhotodumpShotPrompt(options: {
  shotBrief: string
  shotIndex: number
  shotCount: number
  note?: string | null
  usesAestheticReferences: boolean
}): string {
  const note = options.note?.trim()

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
    "Photorealistic, sharp, natural skin texture, Instagram-ready photodump quality.",
  ]
    .filter(Boolean)
    .join(" ")
}
