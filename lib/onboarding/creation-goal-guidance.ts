import type { z } from "zod"
import type { onboardingCreationGoalSchema } from "@/lib/onboarding/payload-schema"

export type OnboardingCreationGoal = z.infer<typeof onboardingCreationGoalSchema>

export type CreationGoalGuidance = {
  primaryAction: string
  route?: string
  agentNotes?: string
}

export const CREATION_GOAL_GUIDANCE: Record<OnboardingCreationGoal, CreationGoalGuidance> = {
  ai_influencer: {
    primaryAction: "Browse Templates for ready-made AI influencer workflows",
    route: "/templates",
    agentNotes:
      "Point them to Templates first. Templates are reusable gallery workflows for consistent character posting — better than improvising from scratch.",
  },
  ugc_social: {
    primaryAction: "Chat here to design a scroll-stopping hook, then set up an Automation",
    route: "/automations",
    agentNotes:
      "Help them craft a strong opening hook (visual + copy), then walk them through creating a scheduled Automation so UGC-style posts run on repeat. Reference the demo automation pattern if helpful.",
  },
  product_ads: {
    primaryAction: "Stay in chat — activate the product photoshoot skill for brand-quality ads",
    agentNotes:
      "For product ads, call activateSkill with slug higgsfield-product-photoshoot before generating. That skill routes through mode-specific prompt enhancement for hero shots, lifestyle scenes, ad packs, and virtual try-on.",
  },
  carousel_posts: {
    primaryAction: "Open Slideshows to build multi-slide carousels",
    route: "/slideshows",
    agentNotes:
      "Carousel posts map to Slideshows — templates, collections, and per-slide image edits in one flow.",
  },
  memes_brainrot: {
    primaryAction: "Stay in chat for fast meme and brainrot remixes",
    agentNotes:
      "Reactive one-off content — use image/video generation, reference remix, and textOverlay for hooks and captions. Keep iteration fast and informal.",
  },
  fashion_lifestyle: {
    primaryAction: "Chat to generate lifestyle looks, or browse Templates for repeatable series",
    route: "/templates",
    agentNotes:
      "Fashion and lifestyle benefit from character or outfit references. Offer chat for bespoke shots; suggest Templates when they want a repeatable posting rhythm.",
  },
}

export function formatCreationGoalGuidance(goals: OnboardingCreationGoal[]): string {
  if (goals.length === 0) {
    return ""
  }

  const lines = goals.map((goal) => {
    const guidance = CREATION_GOAL_GUIDANCE[goal]
    const parts = [`- ${goal}: ${guidance.primaryAction}`]
    if (guidance.route) {
      parts.push(`  Route: ${guidance.route}`)
    }
    if (guidance.agentNotes) {
      parts.push(`  Agent: ${guidance.agentNotes}`)
    }
    return parts.join("\n")
  })

  return [
    "Recommended first actions by creation goal (prioritize the user's selected goals in order):",
    ...lines,
  ].join("\n")
}
