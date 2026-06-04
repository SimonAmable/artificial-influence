# UniCan (`deep-shadcn`) — agent guide

## Working rules

Always make copy on the site user-facing. Focus on user benefit and emotional/personal value instead of including technical detail.

Never build or run dev server to verify new features. Only run `tsc` and `lint` to verify new features. Small few-line changes don't need verification.

Keep UI/UX minimalistic, intuitive, and following the brand/design system — always use CSS variables instead of hard-coded colors.

---

## Product purpose

**UniCan** (`unican.app`) is an AI content platform for creators, marketers, and small teams.

> UniCan is an AI content platform for creators. Generate images, video, lip sync, and scheduled automations from one workspace.  
> — `public/llms.txt`

**Positioning (live homepage hero):** “Introducing vibe marketing” — like Cursor, but for marketing. Create AI UGC, AI influencer content, brainrot, CGI-style campaigns, and static ads with natural language, and schedule posts to Instagram automatically.

**Default metadata tagline:** “Automate faceless content and Instagram marketing with AI” — create more content in less time with AI agents for image, video, and audio generation, plus TikTok and Instagram autoposting.

**Audience:** Creators, marketers, small teams. Language: en.

**Core value loop:** Chat/agent → generate (image/video/audio) → iterate (canvas workflows, edits) → automate (scheduled runs) → publish (Autopost to Instagram). One subscription covers 20+ models; credits power generations and agent runs.

---

## Goals

1. **Ship organic marketing faster** — agent-first creation so users spend less time in tools and more time posting.
2. **One workspace, full stack** — no vendor hopscotch; image, video, audio, workflows, and publishing in one membership.
3. **Repeatable systems** — canvases (node graphs) and automations (cron chat runs) turn one-off wins into pipelines.
4. **SEO/GEO landings** — logged-out feature pages expose crawlable, answer-capsule copy (see feature-landing template).
5. **User-facing copy only** — benefits and outcomes, not model IDs, APIs, or infra unless a surface explicitly shows model names (e.g. model picker, bento cards).

---

## Product shape (let this organize pages)

The product is not a generic SaaS template. Native shapes from the codebase:

| Shape | Where it lives | Design implication |
|-------|----------------|-------------------|
| **Agent / chat thread** | `/chat`, signed-in home redirect | Linear conversation; primary signed-in entry. Hero screenshots: `/page_screenshots_or_screenrecordings/agent.png` |
| **Generator studios** | `/image`, `/video`, `/audio` | Model picker + prompt + output grid |
| **Node graph / canvas** | `/canvases`, `/canvas/[id]` | React Flow pipeline; boxes + connections; rerun whole graph |
| **Scheduled automation** | `/automations` | Prompt + cron + run history as chat threads |
| **Publishing pipeline** | `/autopost` | Instagram connection + schedule (distinct from automations) |
| **Asset library** | `/assets`, `/resources`, `/brand` | Tabs: assets, history, brands, collections |
| **Templates** | `/templates` | Reusable workflow launches |

**Homepage section order (logged-out `/`):** TempHero → ProofSection → PlatformSurfacesSection → ModelsBentoSection → FounderTestimonialSection → PricingSection → FAQSection → FinalCTASection → Footer.

**Platform surfaces (dominant homepage story after hero):** Agents → Generators → Workflows → Automations — see `lib/constants/landing-content.ts` → `platformSurfaceCards`.

**Feature landing template section order:** Hero (+ answer-capsule grid) → optional slots → Bento → Comparison table → Feature steps → FAQ → CTA → Last updated. Config in `lib/constants/feature-landings/<slug>.ts`.

---

## What leads — establish weight before anything else

1. **Homepage:** Vibe marketing + agent (TempHero). Platform surfaces put **Agent** first in the bento row.
2. **Signed-in app:** `/chat` (Agent) is the default post-auth destination.
3. **Navigation mega menu:** Agent group (Agent, Automations, Templates, Autopost) is first and badge-heavy.
4. **Feature landings:** Hero `title` + `tagline` + `tldr` dominate; answer capsules are H2 = verbatim user queries.
5. **Models bento:** “One subscription. Your whole model stack.” — membership breadth, not a single model.

When designing a page, read what that route's config/README leads with and give that feature visual and copy weight before secondary sections.

---

## Critical files

### Copy & product constants (source of truth — do not invent)

| File | Use for |
|------|---------|
| `public/llms.txt` | Product one-liner, core page list, audience |
| `app/layout.tsx` | Site title, default description, OG site name |
| `lib/constants/landing-content.ts` | Homepage hero (legacy), platform surfaces, workflow items, model cards |
| `lib/constants/models-bento-content.ts` | Models bento eyebrow/title/CTAs, featured model identifiers |
| `lib/constants/navigation.ts` | Nav labels, descriptions, badges, dashboard tool hints |
| `lib/constants/feature-landings/*.ts` | Per-route landing copy (automations, canvases) |
| `lib/constants/dashboard-features.ts` | Dashboard feature cards |
| `components/landing/temp-hero.tsx` | Current live homepage headline + subcopy |
| `components/landing/faq-section.tsx` | Homepage FAQ |
| `components/landing/pricing-section.tsx` | Plan names, prices, feature bullets |
| `components/feature-landing/README.md` | Feature landing usage, GEO copy rules, hybrid slots |

### Visual identity

| File | Use for |
|------|---------|
| `app/globals.css` | All design tokens: colors, radius, shadows, typography |
| `components/ui/*` | shadcn components; depth via `[data-slot]` in globals.css |
| `components/landing/*` | Landing section patterns |
| `components/feature-landing/*` | SEO landing template composition |

### App logic & routes

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Public landing vs auth redirect to `/chat` |
| `app/chat/` | Agent |
| `app/automations/`, `app/autopost/`, `app/canvases/` | Automation, publish, workflow list |
| `app/image/`, `app/video/`, `app/audio/` | Generation studios |
| `lib/constants/models.ts`, `model-metadata.ts` | Supported models (names for UI only) |
| `lib/seo/sitemap-routes.ts` | Sitemap when shipping new landings |

---

## Terminology (from config — use these labels)

**Product name:** UniCan (not “Deep Shadcn” — that's the repo folder name).

**Surfaces:** Agent, Automations, Templates, Autopost, Create Image, Image Editing, Character Swap, Motion Copy, Lipsync, Video Editor, Canvas / Workflows, Library, Brand kit, Free Tools, Resources.

**Plans:** Starter (“For getting started”), Plus (“For growing creators”, popular). CTAs: “Start free” / “Get started free”, “View pricing”.

**Badges in nav:** `new`, `popular`, `beta`.

**User-facing content types:** AI UGC, AI influencer content, Reels, carousels, lip sync clips, product shots, faceless content, static ads, brainrot, CGI-style campaigns.

**Do not conflate:** Automations (scheduled AI task runs in chat) vs Autopost (Instagram publishing). Canvases (visual node pipelines) vs Agent chat (exploration).

---

## Design system tokens (`app/globals.css`)

**Typography:** `--font-sans` (system UI stack), `--font-display` (DM Sans). All `h1–h6` use `font-display uppercase`.

**Primary accent:** cyan/teal — `--primary: oklch(0.59 0.22 200)` light, `oklch(0.66 0.21 200)` dark. Use `text-primary`, `bg-primary`, `text-foreground`, `text-muted-foreground`, never raw hex in components.

**Radius:** `--radius: 0.875rem`; scale via `--radius-sm` … `--radius-4xl`. Landing heroes use large radii (`rounded-[2.5rem]`, `rounded-full` buttons).

**Depth:** Custom shadow system — `--shadow-s`, `--shadow-m`, `--shadow-l`, `--shadow-recessed`. Tailwind `shadow-sm/md/lg` map to these. Cards use `--shadow-m`; popovers/dialogs `--shadow-l`.

**Theme:** Default dark (`ThemeProvider defaultTheme="dark"`). Light mode fully supported via `.dark` class toggle.

**Landing patterns:** Gradient overlays on hero media, dot/radial accents (`sky-300/20`), glass/backdrop-blur CTAs, Phosphor icons in feature bento, framer-motion fade-up with reduced-motion respect.

**Components:** shadcn/ui + `@/components/ui/button`, `Card`, `Accordion`, `Tabs`. Feature landings: gradient hero, dot grid, uppercase headline, card TL;DR, shadowed answer-capsule grid.

---

## Design workflow — read before designing

1. **Repo and site are source of truth.** Start with real content. Pull product names, taglines, and copy from `public/llms.txt`, `app/layout.tsx`, and the relevant `lib/constants/*` file. Pull labels and terminology from `navigation.ts`, CLI/UI strings, schemas, and error messages.
2. **Nothing invented, nothing placeholder.** If the repo doesn't contain it, the design doesn't show it.
3. **Inherit the design system.** Use CSS variables from `globals.css`. Match existing landing sections in `components/landing/` and `components/feature-landing/`.
4. **Read core logic, not just docs.** Data structures reveal native shape — graph (canvas), thread (chat), cron list (automations), studio (image/video). Let that shape organize the page instead of a generic section template.
5. **Copy rules for feature landings (GEO):** Hero `tldr` 50–80 words, no links. Answer capsules: H2 = user query, 50–150 words, self-contained. FAQ answers direct; don't duplicate capsules. Set `datePublished` / `lastUpdated` (ISO 8601).
6. **User-facing copy:** Simple, informative, emotional benefit. Occasional model names on model surfaces only; descriptions stay benefit-led.

---

## Verification

- `npm run typecheck` and `npm run lint` for code changes.
- Do not start dev server for verification.
- When adding a feature landing: update `lib/seo/sitemap-routes.ts` and `public/llms.txt`.
