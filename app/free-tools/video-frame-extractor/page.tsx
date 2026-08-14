import type { Metadata } from "next"

import { VideoFrameExtractorTool } from "@/components/tools/video-frame-extractor"

export const metadata: Metadata = {
  title: "Video Frame Extractor",
  description: "Extract the first or last frame from a video as a PNG still, locally in your browser.",
}

export default function VideoFrameExtractorPage() {
  return <VideoFrameExtractorTool />
}
