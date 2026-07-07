import { presenceStudioProduct } from "@/lib/product/products/presence-studio"
import { unicanProduct } from "@/lib/product/products/unican"
import type { ProductConfig, ProductId } from "@/lib/product/types"

const products: Record<ProductId, ProductConfig> = {
  unican: unicanProduct,
  "presence-studio": presenceStudioProduct,
}

export function getProductById(productId: string | undefined): ProductConfig {
  if (productId && productId in products) {
    return products[productId as ProductId]
  }

  return unicanProduct
}

export const currentProduct = getProductById(process.env.NEXT_PUBLIC_PRODUCT_ID)

export function getCurrentProductSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? currentProduct.siteUrl
  return raw.replace(/\/$/, "")
}
