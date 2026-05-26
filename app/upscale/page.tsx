import type { Metadata } from "next"

import { UpscaleTool } from "@/components/tools/upscale"

export const metadata: Metadata = {
  title: "Upscale",
  description: "Upload an image and enhance its resolution and quality for 1 credit.",
}

export default function UpscalePage() {
  return <UpscaleTool />
}
