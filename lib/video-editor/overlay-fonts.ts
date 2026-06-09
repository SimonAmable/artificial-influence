/** Remotion-only — approved Snapchat font loading. Do not change weights here. */
import { loadFont } from "@remotion/google-fonts/PublicSans"

const { fontFamily } = loadFont("normal", {
  weights: ["200"],
  subsets: ["latin"],
})

/** Resolved family string from @remotion/google-fonts — use in CSS when available. */
export const PUBLIC_SANS_FONT_FAMILY = fontFamily
