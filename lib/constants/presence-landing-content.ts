import type { LandingPlatformSurfaceCard } from "@/lib/types/landing"

export type PresenceFaqItem = {
  question: string
  answer: string
}

export type PresenceMonetizeTile = {
  title: string
  description: string
  href: string
  imageSrc?: string
}

export const presenceLandingCopy = {
  hero: {
    title: "The AI influencer studio for creating, publishing, and earning",
    description:
      "Design consistent characters, generate photos and video, publish to Fanvue, and build a content business from one focused studio.",
    primaryCtaLabel: "Start creating free",
    primaryCtaHref: "/login?mode=signup",
    secondaryCtaLabel: "See pricing",
    secondaryCtaHref: "/#pricing",
    previewAlt: "Presence Studio AI influencer workflow screenshot",
  },
  metadata: {
    title: "Presence Studio - AI influencer content studio",
    description:
      "Create AI influencers, generate character-led content, publish to Fanvue, and build a repeatable content business from one focused studio.",
  },
  proof: {
    title: "AI influencers are already winning on social",
  },
  workflow: {
    title: "Create and publish, all in one place",
  },
  monetize: {
    title: "From studio to Fanvue",
    description:
      "Presence Studio connects creation to monetization so you can publish and earn without switching tools.",
    ctaLabel: "Try it",
    placeholderImageSrc: "/logo.svg",
    tiles: [
      {
        title: "Publish to Fanvue",
        description: "Push photos and videos straight to your vault when content is ready to sell.",
        href: "/content",
      },
      {
        title: "Paid posts",
        description: "Sell individual unlocks for your best photos and videos.",
        href: "/content",
      },
      {
        title: "Subscriptions",
        description: "Turn followers into recurring revenue with exclusive access.",
        href: "/content",
      },
      {
        title: "Consistent characters",
        description: "Keep the same face across every post you monetize.",
        href: "/ai-influencer",
      },
      {
        title: "Tips",
        description: "Let fans support you directly with one-tap tips on your best content.",
        href: "/content",
      },
    ] satisfies PresenceMonetizeTile[],
  },
  modelsBento: {
    title: "Win the feed with one subscription",
    description:
      "The best image and video models for AI influencer content, always up to date, all in one plan.",
    primaryCtaLabel: "Start creating free",
    primaryCtaHref: "/login?mode=signup",
    secondaryCtaLabel: "See pricing",
    secondaryCtaHref: "/#pricing",
  },
  pricing: {
    title: "Professional AI, priced for creators",
    description: "Start free, upgrade when you are ready. Credits stack month to month.",
    monthlyFooter:
      "Create consistently with credits that stay in your balance. Publish to Fanvue on every plan. Cancel anytime.",
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      {
        question: "How does Presence Studio help me build AI influencers faster?",
        answer:
          "You work with an agent built for character-led content. Describe the look, scene, or post you want, generate images and video with consistent faces, then publish to Fanvue when you are ready.",
      },
      {
        question: "What can I actually make?",
        answer:
          "Character stills, short-form video, template-driven shoots, and vault-ready posts. Same day you might build a new influencer, generate a batch of images, and prep content for publishing.",
      },
      {
        question: "Can I publish and monetize on Fanvue?",
        answer:
          "Yes. Presence Studio connects directly to Fanvue so you can publish photos and videos to your vault and monetize through paid posts, subscriptions, and more.",
      },
      {
        question: "How do credits work?",
        answer:
          "Every generation costs credits. Different models and output types use different amounts. Monthly credits from your plan stack over time if unused. You can also buy top-up credits when you need more.",
      },
      {
        question: "Can I use my creations commercially?",
        answer:
          "Yes. Your creations are yours to use commercially. Publish and monetize on Fanvue directly from Presence Studio.",
      },
      {
        question: "Is NSFW allowed?",
        answer:
          "Yes. Models that support adult content have it enabled where the provider allows it. Some models include built-in safety filters at the provider level, so those will not generate NSFW output. You are responsible for following Fanvue content rules and the laws in your jurisdiction. Illegal content is strictly prohibited.",
      },
      {
        question: "Can I start free?",
        answer: "Yes. Sign up and try the main flows. Plans and limits are on the pricing section below.",
      },
    ] satisfies PresenceFaqItem[],
  },
  finalCta: {
    title: "Ready to create without limits",
    description:
      "Start free. Build your AI influencer. Publish to Fanvue when you are ready to earn.",
    primaryCtaLabel: "Start creating free",
    primaryCtaHref: "/login?mode=signup",
    secondaryCtaLabel: "See pricing",
    secondaryCtaHref: "/#pricing",
    contactSubject: "Contact: Presence Studio support",
  },
} as const

export const presencePlatformSurfaceCards: LandingPlatformSurfaceCard[] = [
  {
    kind: "image",
    id: "agent",
    name: "Agents",
    sectionBlurb:
      "Describe a post in chat and get vault-ready content without opening a canvas.",
    description:
      "Create images, video, edits, and multi-step projects in chat without touching a canvas.",
    href: "/chat",
    cta: "Open",
    imageSrc: "/page_screenshots_or_screenrecordings/agent.png",
    imageAlt: "Presence Studio agent UI screenshot",
    safariUrl: "artificialinfluence.tech/chat",
    layoutClass: "lg:col-span-4 lg:min-h-[300px]",
  },
  {
    kind: "image",
    id: "generator",
    name: "Generators",
    sectionBlurb:
      "Generate photoreal stills and cinematic video with the models creators actually use.",
    description:
      "Generate photoreal stills and cinematic video with the models creators actually use.",
    href: "/image",
    cta: "Open",
    imageSrc: "/page_screenshots_or_screenrecordings/generator.png",
    imageAlt: "Presence Studio generator UI screenshot",
    safariUrl: "artificialinfluence.tech/image",
    layoutClass: "lg:col-span-8 lg:min-h-[300px]",
  },
  {
    kind: "image",
    id: "workflow",
    name: "Workflows",
    sectionBlurb:
      "Build repeatable shoots and character pipelines you can rerun in one click.",
    description:
      "Build repeatable shoots and character pipelines you can rerun in one click.",
    href: "/canvases",
    cta: "Open",
    imageSrc: "/page_screenshots_or_screenrecordings/workflow.png",
    imageAlt: "Presence Studio workflow UI screenshot",
    safariUrl: "artificialinfluence.tech/canvas",
    layoutClass: "lg:col-span-6 lg:min-h-[280px]",
  },
  {
    kind: "automation",
    id: "automation",
    name: "Fanvue",
    sectionBlurb: "Publish directly to Fanvue when your content is ready to sell.",
    description: "Publish directly to Fanvue when your content is ready to sell.",
    href: "/content",
    cta: "Open",
    safariUrl: "artificialinfluence.tech/content",
    layoutClass: "lg:col-span-6 lg:min-h-[280px]",
  },
]
