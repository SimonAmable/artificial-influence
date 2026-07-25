import type { Metadata } from "next"

import { GuidesHub } from "@/components/guides/guides-hub"
import { currentProduct } from "@/lib/product/current"

export const metadata: Metadata = {
  title: `Learn ${currentProduct.name}`,
  description:
    "How to make the most realistic AI influencer content — with guides written alongside the biggest creators in the industry.",
}

export default function GuidesPage() {
  return <GuidesHub />
}
