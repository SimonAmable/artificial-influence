import { currentProduct } from "@/lib/product/current"
import type { ProductConfig } from "@/lib/product/types"

export function isOnboardingEnabled(
  product: Pick<ProductConfig, "onboardingEnabled"> = currentProduct,
): boolean {
  return product.onboardingEnabled
}
