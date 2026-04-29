import type { Metadata } from "next"

import { TikTokVideoFixerTool } from "@/components/tools/tiktok-video-fixer"

export const metadata: Metadata = {
  title: "TikTok Video Fixer",
  description: "Convert videos into a safer TikTok-compatible MP4 profile with FFmpeg.",
}

export default function TikTokVideoFixerPage() {
  return <TikTokVideoFixerTool />
}
