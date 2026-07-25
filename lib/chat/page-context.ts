import { getGuideArticleBySlug } from "@/lib/guides/content"

export type GuidePageContext = {
  kind: "guide"
  path: string
  slug: string
  title: string
  result: string
  primaryCta: { label: string; href: string }
  tools: Array<{ label: string; href: string }>
  stepTitles: string[]
  askAgentPrompt: string
}

export type GuidesHubPageContext = {
  kind: "guides-hub"
  path: string
  title: string
  result: string
}

export type UnknownPageContext = {
  kind: "unknown"
  path: string
  message: string
}

export type AppPageContext = GuidePageContext | GuidesHubPageContext | UnknownPageContext

/** Normalize a client-sent page path for agent context. */
export function normalizePagePath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 512) return undefined

  let pathname = trimmed

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      pathname = new URL(trimmed).pathname
    } catch {
      return undefined
    }
  }

  if (!pathname.startsWith("/")) return undefined

  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? ""
  if (!withoutQuery.startsWith("/")) return undefined

  return withoutQuery || "/"
}

export function resolveAppPageContext(pagePath: string): AppPageContext {
  if (pagePath === "/guides" || pagePath === "/guides/") {
    return {
      kind: "guides-hub",
      path: "/guides",
      title: "Guides",
      result: "Browse how-to guides for the studio.",
    }
  }

  const match = pagePath.match(/^\/guides\/([^/]+)\/?$/)
  if (match?.[1]) {
    let slug = match[1]
    try {
      slug = decodeURIComponent(slug)
    } catch {
      // Keep raw segment if decoding fails.
    }

    const article = getGuideArticleBySlug(slug)
    if (article) {
      return {
        kind: "guide",
        path: `/guides/${article.slug}`,
        slug: article.slug,
        title: article.title,
        result: article.result,
        primaryCta: {
          label: article.primaryCtaLabel,
          href: article.primaryCtaHref,
        },
        tools: article.tools.map((tool) => ({
          label: tool.label,
          href: tool.href,
        })),
        stepTitles: (article.steps ?? []).map((step) => step.title),
        askAgentPrompt: article.askAgentPrompt,
      }
    }
  }

  return {
    kind: "unknown",
    path: pagePath,
    message:
      "No structured page context for this route yet. Answer from the path and the user message only.",
  }
}

/** One-line runtime hint — never dumps guide bodies. */
export function formatPagePathRuntimeHint(pagePath: string | undefined): string {
  if (!pagePath) return ""
  return `User viewing: ${pagePath}`
}
