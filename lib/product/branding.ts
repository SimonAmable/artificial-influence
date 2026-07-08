import { currentProduct } from "@/lib/product/current"

export const productLogo = currentProduct.logo

export const productOgImage =
  currentProduct.metadata.ogImage ?? currentProduct.logo

/** UniCan SVG marks need invert on dark UI; Presence PNG does not. */
export function productLogoNeedsInvert(): boolean {
  return currentProduct.id === "unican"
}

export function productLogoClassName(extra?: string): string {
  const base =
    currentProduct.logoClassName ??
    (productLogoNeedsInvert() ? "dark:invert" : "")
  return extra ? `${base} ${extra}`.trim() : base
}
