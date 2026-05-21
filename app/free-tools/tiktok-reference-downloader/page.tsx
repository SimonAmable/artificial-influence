import type { Metadata } from "next"

import { TikTokReferenceDownloaderTool } from "@/components/tools/tiktok-reference-downloader"

export const metadata: Metadata = {
  title: "TikTok & Instagram reference downloader",
  description:
    "Paste a TikTok or Instagram post or reel URL to download media, copy the link, or open video in Motion Control.",
}

export default function TikTokReferenceDownloaderPage() {
  return <TikTokReferenceDownloaderTool />
}
