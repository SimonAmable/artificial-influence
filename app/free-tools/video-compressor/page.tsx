import type { Metadata } from "next"

import { VideoCompressorTool } from "@/components/tools/video-compressor"

export const metadata: Metadata = {
  title: "Video Compressor",
  description: "Compress short videos locally into smaller WebM files.",
}

export default function VideoCompressorPage() {
  return <VideoCompressorTool />
}
