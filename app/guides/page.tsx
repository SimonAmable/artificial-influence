import type { Metadata } from "next"

import { GuidesHub } from "@/components/guides/guides-hub"
import { currentProduct } from "@/lib/product/current"

export const metadata: Metadata = {
  title: "Guides",
  description: `Short action-to-result playbooks for ${currentProduct.name}.`,
}

export default function GuidesPage() {
  return <GuidesHub />
}
