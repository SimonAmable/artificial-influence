import Link from "next/link"
import { ArrowRight } from "@phosphor-icons/react/dist/ssr"

import { GuideMarkComplete } from "@/components/guides/guide-mark-complete"
import { GuideModePathCards } from "@/components/guides/guide-mode-path-cards"
import {
  GuideMcpConnectEmbed,
  GuideMcpFan,
  GuideMcpPlatformProvider,
} from "@/components/guides/guide-mcp-section"
import { GuidePromptTrySection } from "@/components/guides/guide-prompt-try"
import { GuideCarouselUploadSection } from "@/components/guides/guide-carousel-upload"
import { GuideFanvueTrySection } from "@/components/guides/guide-fanvue-try"
import { GuideCompareTableSection } from "@/components/guides/guide-compare-table"
import { GuideInfoSections, GuideLogoStrip } from "@/components/guides/guide-info-sections"
import { GuideOverviewText } from "@/components/guides/guide-overview-text"
import { GuideStepsSection } from "@/components/guides/guide-steps-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShaderDemoCard } from "@/components/ui/shader-demo-card"
import { GUIDE_ARTICLES, GUIDE_HUB_CARDS } from "@/lib/guides/content"
import type { GuideArticle, GuideHubCard } from "@/lib/guides/types"
import { getMcpConnectBaseUrl } from "@/lib/mcp/auth"
import { currentProduct, getCurrentProductSiteUrl } from "@/lib/product/current"
import { isVisibleByProductMetadata } from "@/lib/product/visibility"

function resolveNextGuideCard(article: GuideArticle): GuideHubCard | null {
  const visited = new Set<string>()
  let slug: string | null | undefined = article.nextGuideSlug

  while (slug) {
    if (visited.has(slug)) break
    visited.add(slug)

    const card = GUIDE_HUB_CARDS.find((item) => item.slug === slug)
    if (!card) break
    if (isVisibleByProductMetadata(card, currentProduct.id)) return card

    const nextArticle = GUIDE_ARTICLES.find((item) => item.slug === slug)
    slug = nextArticle?.nextGuideSlug ?? null
  }

  if (article.nextGuideLabel) {
    const card = GUIDE_HUB_CARDS.find((item) => item.title === article.nextGuideLabel)
    if (card && isVisibleByProductMetadata(card, currentProduct.id)) return card
  }

  return null
}

export function GuideArticleView({ article }: { article: GuideArticle }) {
  const nextGuideCard = resolveNextGuideCard(article)
  const isInfo = article.presentation === "info"
  const isMcp = article.presentation === "mcp"
  const siteUrl = getCurrentProductSiteUrl()
  const mcpBaseUrl = getMcpConnectBaseUrl(currentProduct.mcpSiteUrl ?? siteUrl)

  const articleBody = (
    <>
      <GuideMarkComplete slug={article.slug} />
      <header className="flex flex-col gap-4">
        {isMcp ? (
          <GuideMcpFan productName={currentProduct.name} logoSrc={currentProduct.logo} />
        ) : null}

        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {article.title}
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {article.result}
          </p>
        </div>

        {isInfo && article.logoStrip && article.logoStrip.length > 0 ? (
          <GuideLogoStrip logos={article.logoStrip} />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-medium">
            {article.timeEstimate}
          </Badge>
          {article.tools.map((tool) => (
            <Badge
              key={tool.href}
              variant="outline"
              className="rounded-full px-0 py-0 text-xs font-medium"
              asChild
            >
              <Link
                href={tool.href}
                className="inline-flex items-center px-2.5 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
              >
                {tool.label}
              </Link>
            </Badge>
          ))}
        </div>

        <div>
          <Button asChild size="lg">
            <Link href={article.primaryCtaHref}>
              {article.primaryCtaLabel}
              <ArrowRight data-icon="inline-end" className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      {article.overview ? (
        <section className="flex flex-col gap-4 border-t border-border/70 pt-8">
          <div className="flex flex-col gap-4">
            {article.overview
              .split(/\n\n+/)
              .map((paragraph) => paragraph.trim())
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index} className="text-base leading-7 text-muted-foreground">
                  <GuideOverviewText text={paragraph} />
                </p>
              ))}
          </div>
        </section>
      ) : null}

      {isMcp ? (
        <section className="border-t border-border/70 pt-8">
          <GuideMcpConnectEmbed
            productName={currentProduct.name}
            mcpBaseUrl={mcpBaseUrl}
            logoSrc={currentProduct.logo}
            showToolsPreview={article.slug !== "mcp"}
          />
        </section>
      ) : null}

      {article.paths && article.paths.length > 0 ? (
        <GuideModePathCards
          heading={article.pathsHeading ?? "Pick one starting point"}
          paths={article.paths}
          relation={article.pathsRelation ?? "or"}
        />
      ) : null}

      {article.steps && article.steps.length > 0 ? (
        <GuideStepsSection
          heading={article.stepsHeading ?? "Steps"}
          steps={article.steps}
        />
      ) : null}

      {article.infoSections && article.infoSections.length > 0 ? (
        <GuideInfoSections
          heading={article.infoSectionsHeading ?? "Key points"}
          sections={article.infoSections}
          numbered={article.infoSectionsNumbered}
        />
      ) : null}

      {article.compareTable ? (
        <GuideCompareTableSection
          table={{
            ...article.compareTable,
            columns: article.compareTable.columns.map((column, index) =>
              index === 1 ? currentProduct.name : column
            ),
          }}
        />
      ) : null}

      {article.promptTry ? <GuidePromptTrySection promptTry={article.promptTry} /> : null}

      {article.carouselUpload ? (
        <GuideCarouselUploadSection upload={article.carouselUpload} />
      ) : null}

      {article.fanvueTry ? <GuideFanvueTrySection tryBlock={article.fanvueTry} /> : null}

      {article.outcomes && article.outcomes.length > 0 ? (
        <section className="flex flex-col gap-3 border-t border-border/70 pt-8">
          <h2 className="text-sm text-muted-foreground">
            {article.outcomesHeading ?? "You'll leave with"}
          </h2>
          <ul className="flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
            {article.outcomes.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-foreground/40" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {nextGuideCard ? (
        <section className="flex flex-col gap-4 border-t border-border/70 pt-8">
          <h2 className="text-sm text-muted-foreground">
            Next guide
          </h2>
          {isInfo || isMcp ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold tracking-tight">{nextGuideCard.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{nextGuideCard.description}</p>
              </div>
              {nextGuideCard.available ? (
                <Button asChild variant="outline" className="shrink-0">
                  <Link href={`/guides/${nextGuideCard.slug}`}>
                    Open guide
                    <ArrowRight data-icon="inline-end" className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Badge variant="secondary" className="w-fit shrink-0 rounded-full">
                  Soon
                </Badge>
              )}
            </div>
          ) : (
            <ShaderDemoCard
              href={
                nextGuideCard.available ? `/guides/${nextGuideCard.slug}` : undefined
              }
              disabled={!nextGuideCard.available}
              buttonLabel={nextGuideCard.available ? "Open guide" : "Soon"}
              title={nextGuideCard.title}
              description={nextGuideCard.description}
              mediaSrc={nextGuideCard.mediaSrc}
              mediaAlt={nextGuideCard.mediaAlt}
              mediaFit="contain"
              mediaWater={Boolean(nextGuideCard.mediaSrc)}
              copyPlacement="above"
              className="w-full"
            />
          )}
        </section>
      ) : article.nextGuideLabel && !article.nextGuideSlug ? (
        <section className="flex flex-col gap-4 border-t border-border/70 pt-8">
          <h2 className="text-sm text-muted-foreground">
            Next guide
          </h2>
          {isInfo || isMcp ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-base font-semibold tracking-tight">{article.nextGuideLabel}</p>
              <Badge variant="secondary" className="w-fit shrink-0 rounded-full">
                Soon
              </Badge>
            </div>
          ) : (
            <ShaderDemoCard
              disabled
              buttonLabel="Soon"
              title={article.nextGuideLabel}
              copyPlacement="above"
              className="w-full"
            />
          )}
        </section>
      ) : null}
    </>
  )

  return (
    <article className="flex w-full min-w-0 max-w-4xl flex-col gap-10">
      {isMcp ? (
        <GuideMcpPlatformProvider>{articleBody}</GuideMcpPlatformProvider>
      ) : (
        articleBody
      )}
    </article>
  )
}
