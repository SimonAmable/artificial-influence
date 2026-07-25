import type { Metadata } from "next"

import { MetadataRemoverTool } from "@/components/tools/metadata-remover"

export const metadata: Metadata = {
  title: "Metadata Remover",
  description: "Strip metadata for free. Add SynthID scrub for Google AI images.",
}

export default function MetadataRemoverPage() {
  return <MetadataRemoverTool />
}
