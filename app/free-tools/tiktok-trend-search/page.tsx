import type { Metadata } from "next"

import { TikTokTrendSearchTool } from "@/components/tools/tiktok-trend-search"

export const metadata: Metadata = {
  title: "TikTok trend search",
  description:
    "Search TikTok video results with sorting and date filters, then remix clips with Motion Control.",
}

export default function TikTokTrendSearchPage() {
  return <TikTokTrendSearchTool />
}
