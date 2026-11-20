import localFont from "next/font/local"

/** Self-hosted Orbitron (latin, variable 600–700). next/font/google crashes Turbopack on this variable file. */
export const fontBrand = localFont({
  src: "./orbitron-latin.woff2",
  weight: "600 700",
  display: "swap",
  variable: "--font-brand",
})
