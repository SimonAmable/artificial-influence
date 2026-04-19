export type BrandColorRole =

  | "primary"

  | "secondary"

  | "accent"

  | "background"

  | "surface"

  | "text"

  | "other"



export type BrandColorToken = {

  hex: string

  role: BrandColorRole

  label?: string

}



export type BrandTypography = {

  headingFont?: string

  bodyFont?: string

  monoFont?: string

  notes?: string

}



export type BrandReferenceMediaItem = {

  url: string

  kind: "image" | "video"

}



export type BrandKit = {

  id: string

  name: string

  isDefault: boolean

  websiteUrl?: string | null

  fontFamily?: string | null

  /** DB: `reference_images`: URL list. */

  referenceImages: string[]

  /** DB: `reference_videos`: URL list. */

  referenceVideos: string[]

  /**

   * Convenience: images first, then videos (same grid as two columns in DB).

   */

  referenceMedia: BrandReferenceMediaItem[]

  brandValues: string[]

  aestheticTags: string[]

  toneTags: string[]

  /** Optional long notes (DB column `notes`). */

  notes: string | null

  logoUrl: string | null

  logoDarkUrl: string | null

  iconUrl: string | null

  iconDarkUrl: string | null

  colors: BrandColorToken[]

  typography: BrandTypography

  tagline: string | null

  avoidWords: string[]

  layoutNotes: string | null

  audience: string | null

  createdAt: string

  updatedAt: string

}



export const BRAND_COLOR_ROLES: BrandColorRole[] = [

  "primary",

  "secondary",

  "accent",

  "background",

  "surface",

  "text",

  "other",

]

