# Feature landing template

Server-rendered landings for logged-out visitors, tuned for SEO and GEO (generative / AI search). Use when a route should expose crawlable copy instead of an empty state.

## Usage

1. Add a config in `lib/constants/feature-landings/<slug>.ts` implementing `FeatureLandingConfig` from `lib/types/feature-landing.ts`.
2. In `app/<route>/page.tsx`, resolve auth on the server; if unauthenticated, render `<FeatureLanding config={...} />`, otherwise the app UI.
3. Call `buildFeatureLandingMetadata(config)` for `export const metadata`.
4. Update `lib/seo/sitemap-routes.ts` and `public/llms.txt` when you ship a new landing.

## Hybrid slots

Pass optional `slots` for custom sections without forking the template:

- `afterHero`, e.g. `AutomationLogoConnection` on `/automations`
- `beforeShowcase` / `afterShowcase`, around the bento block
- `beforeFAQ` / `afterFAQ`, around the FAQ accordion

## Copy rules (GEO)

- **Hero `tldr`:** one paragraph, about 50–80 words, no links inside.
- **Answer capsules:** H2 = verbatim user query; answer 50–150 words, self-contained, no links inside the paragraph.
- **FAQ:** direct answers; avoid duplicating the same Q&A as capsules.
- **Dates:** set `datePublished`, `lastUpdated` (ISO 8601); visible “Last updated” and sitemap `lastModified` follow `lastUpdated`.

## Files

- `feature-landing.tsx`, composition and section order
- `feature-landing-jsonld.tsx`, `WebPage`, `BreadcrumbList`, `FAQPage`, optional `SoftwareApplication` / `HowTo`
- `feature-landing-hero.tsx`, landing-style hero (gradient, dot grid, uppercase headline, card TL;DR, media) plus answer-capsule **card grid** in the same section
- `feature-landing-answer-capsules.tsx`, responsive `Card` grid (shadowed, site-aligned); `sectionTitle` prop for the heading above the grid
- Bento (**client**, Phosphor icons use React context), comparison table, feature list, FAQ (client accordion), CTA, last updated
