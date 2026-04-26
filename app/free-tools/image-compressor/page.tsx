import type { Metadata } from "next"

import { ImageCompressorTool } from "@/components/tools/image-compressor"

export const metadata: Metadata = {
  title: "Image Compressor",
  description: "Compress and resize images locally in your browser.",
}

export default function ImageCompressorPage() {
  return <ImageCompressorTool />
}
