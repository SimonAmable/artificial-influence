import type { Metadata } from "next"

import { MetadataRemoverTool } from "@/components/tools/metadata-remover"

export const metadata: Metadata = {
  title: "Metadata Remover",
  description: "Remove embedded metadata from AI images locally in your browser.",
}

export default function MetadataRemoverPage() {
  return <MetadataRemoverTool />
}
