import type { Metadata } from "next"

import { GuidesHub } from "@/components/guides/guides-hub"
import { currentProduct } from "@/lib/product/current"

export const metadata: Metadata = {
  title: `Learn ${currentProduct.name}`,
  description:
    "Make better AI creator content, post more often, and learn what helps it spread.",
}

export default function GuidesPage() {
  return <GuidesHub />
}
