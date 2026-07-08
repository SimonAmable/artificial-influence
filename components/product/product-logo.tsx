import Image from "next/image"

import { currentProduct } from "@/lib/product/current"
import { productLogoClassName } from "@/lib/product/branding"
import { cn } from "@/lib/utils"

type ProductLogoProps = {
  size?: number
  className?: string
  alt?: string
}

export function ProductLogo({ size, className, alt }: ProductLogoProps) {
  const px = size ?? currentProduct.logoSizePx ?? 22

  return (
    <Image
      src={currentProduct.logo}
      alt={alt ?? `${currentProduct.name} logo`}
      width={px}
      height={px}
      className={cn(productLogoClassName(), className)}
    />
  )
}
