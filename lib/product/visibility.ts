import { currentProduct } from "@/lib/product/current"
import type { ProductConfig, ProductId } from "@/lib/product/types"

function normalizePath(path: string): string {
  const withoutQuery = path.split("?")[0] || "/"
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/$/, "") : withoutQuery
}

export function isRouteVisibleForProduct(
  path: string,
  product: Pick<ProductConfig, "visibleRoutes"> = currentProduct,
): boolean {
  const normalizedPath = normalizePath(path)

  return product.visibleRoutes.some((route) => {
    const normalizedRoute = normalizePath(route)
    return (
      normalizedPath === normalizedRoute ||
      (normalizedRoute !== "/" && normalizedPath.startsWith(`${normalizedRoute}/`))
    )
  })
}

export interface ProductVisibility {
  products?: ProductId[]
  hiddenFor?: ProductId[]
}

export function isVisibleByProductMetadata(
  item: ProductVisibility,
  productId: ProductId = currentProduct.id,
): boolean {
  if (item.hiddenFor?.includes(productId)) return false
  if (item.products?.length && !item.products.includes(productId)) return false
  return true
}
