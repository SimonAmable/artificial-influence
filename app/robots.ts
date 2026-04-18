import type { MetadataRoute } from "next"

import { getSiteBaseUrl } from "@/lib/seo/site-url"

export default function robots(): MetadataRoute.Robots {
  const base = getSiteBaseUrl()
  return {
    rules: [
      {
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-SearchBot",
          "anthropic-ai",
          "PerplexityBot",
          "Perplexity-User",
          "Google-Extended",
          "CCBot",
        ],
        allow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/chat/", "/onboarding"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base.replace(/^https?:\/\//, ""),
  }
}
