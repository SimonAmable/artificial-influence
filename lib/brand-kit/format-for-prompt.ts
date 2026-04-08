import type { BrandKit } from "./types"



function lines(parts: (string | null | undefined)[]): string {

  return parts.filter((p) => p && String(p).trim().length > 0).join("\n")

}



/**

 * Compact text block for system prompts so image/video/copy models stay on-brand.

 */

export function formatBrandKitForPrompt(kit: BrandKit): string {

  const colorLines =

    kit.colors?.length > 0

      ? kit.colors

          .map((c) => {

            const label = c.label?.trim() ? `${c.label.trim()} ` : ""

            return `- ${label}(${c.role}): ${c.hex}`

          })

          .join("\n")

      : ""



  const typo = kit.typography || {}

  const typoBlock = lines([

    typo.headingFont ? `Heading font: ${typo.headingFont}` : null,

    typo.bodyFont ? `Body font: ${typo.bodyFont}` : null,

    typo.monoFont ? `Monospace: ${typo.monoFont}` : null,

    typo.notes ? `Type notes: ${typo.notes}` : null,

  ])



  const avoid =

    kit.avoidWords?.length > 0 ? `Avoid (words, styles, clichés): ${kit.avoidWords.join(", ")}` : null



  const assets = lines([

    kit.logoUrl ? `Logo (light): ${kit.logoUrl}` : null,

    kit.logoDarkUrl ? `Logo (dark): ${kit.logoDarkUrl}` : null,

    kit.iconUrl ? `Icon (light): ${kit.iconUrl}` : null,

    kit.iconDarkUrl ? `Icon (dark): ${kit.iconDarkUrl}` : null,

  ])



  const website = kit.websiteUrl?.trim() || ""



  const refBlock = (() => {

    const items = kit.referenceMedia

    if (items.length === 0) return null

    return `Reference / mood media:\n${items.map((m) => `- (${m.kind}) ${m.url}`).join("\n")}`

  })()



  const extraBlock = lines([

    website ? `Website: ${website}` : null,

    kit.fontFamily?.trim() ? `Brand font: ${kit.fontFamily.trim()}` : null,

    kit.brandValues.length > 0 ? `Brand values: ${kit.brandValues.join(", ")}` : null,

    kit.aestheticTags.length > 0 ? `Brand aesthetic: ${kit.aestheticTags.join(", ")}` : null,

    kit.toneTags.length > 0 ? `Tone of voice: ${kit.toneTags.join(", ")}` : null,

    refBlock,

    kit.notes?.trim() ? `Notes: ${kit.notes.trim()}` : null,

  ])



  const body = lines([

    `Name: ${kit.name}`,

    kit.tagline ? `Tagline: ${kit.tagline}` : null,

    kit.audience ? `Audience: ${kit.audience}` : null,

    avoid,

    colorLines ? `Palette:\n${colorLines}` : null,

    typoBlock ? `Typography:\n${typoBlock}` : null,

    kit.layoutNotes ? `Layout & composition: ${kit.layoutNotes}` : null,

    extraBlock ? `Brand details:\n${extraBlock}` : null,

    assets ? `Asset URLs (respect in layouts; do not invent different marks):\n${assets}` : null,

  ])



  return body.trim()

}



export function isBrandKitEffectivelyEmpty(kit: BrandKit): boolean {

  const hasUrls = Boolean(

    kit.logoUrl || kit.logoDarkUrl || kit.iconUrl || kit.iconDarkUrl,

  )

  const hasColors = (kit.colors?.length ?? 0) > 0

  const hasTypo = Object.values(kit.typography || {}).some(

    (v) => typeof v === "string" && v.trim().length > 0,

  )

  const hasText = [kit.tagline, kit.layoutNotes, kit.audience, kit.notes].some(

    (t) => t && t.trim().length > 0,

  )

  const hasLists =

    (kit.avoidWords?.length ?? 0) > 0 ||

    kit.brandValues.length > 0 ||

    kit.aestheticTags.length > 0 ||

    kit.toneTags.length > 0

  const hasWebOrFont = Boolean(kit.websiteUrl?.trim()) || Boolean(kit.fontFamily?.trim())

  const hasRef = kit.referenceImages.length > 0 || kit.referenceVideos.length > 0

  return (

    !hasUrls &&

    !hasColors &&

    !hasTypo &&

    !hasText &&

    !hasLists &&

    !hasWebOrFont &&

    !hasRef

  )

}

