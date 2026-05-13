import { z } from "zod"
import {
  onboardingAiExperienceSchema,
  onboardingCreationGoalSchema,
  onboardingJsonDataSchema,
  onboardingPrioritySchema,
  onboardingReferralSourceSchema,
  onboardingTeamSizeSchema,
  type OnboardingRole,
} from "@/lib/onboarding/payload-schema"

type OnboardingTeamSize = z.infer<typeof onboardingTeamSizeSchema>
type OnboardingCreationGoal = z.infer<typeof onboardingCreationGoalSchema>
type OnboardingAiExperience = z.infer<typeof onboardingAiExperienceSchema>
type OnboardingPriority = z.infer<typeof onboardingPrioritySchema>
type OnboardingReferralSource = z.infer<typeof onboardingReferralSourceSchema>

const ROLE_LABELS: Record<OnboardingRole, string> = {
  ai_influencer: "AI influencer",
  ai_agency: "AI creative agency",
  founder: "Founder / owner",
  marketer: "Marketing & growth",
  creator: "Content creator",
  other: "Other",
}

const TEAM_SIZE_LABELS: Record<OnboardingTeamSize, string> = {
  solo: "Solo",
  "2-20": "2-20 people",
  "21-200": "21-200 people",
  "200+": "200+ people",
}

const CREATION_GOAL_LABELS: Record<OnboardingCreationGoal, string> = {
  ugc_social: "UGC & Social",
  ai_influencer: "AI Influencers",
  product_ads: "Product Ads",
  memes_brainrot: "Memes & Brainrot",
  carousel_posts: "Carousel Posts",
  fashion_lifestyle: "Fashion & Lifestyle",
}

const AI_EXPERIENCE_LABELS: Record<OnboardingAiExperience, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
}

const PRIORITY_LABELS: Record<OnboardingPriority, string> = {
  video_quality: "Video quality",
  generation_speed: "Fast generation speed",
  ease_of_use: "Ease of use",
  affordable_pricing: "Affordable pricing",
  creative_control: "Creative control",
  unique_models: "Unique AI models",
}

const REFERRAL_SOURCE_LABELS: Record<OnboardingReferralSource, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  instagram: "Instagram",
  twitter: "Twitter / X",
  google: "Google Search",
  friend: "Friend / word of mouth",
  reddit: "Reddit",
  other: "Other",
}

export function buildOnboardingHiddenContext(raw: unknown): string {
  const parsed = onboardingJsonDataSchema.safeParse(raw)
  if (!parsed.success) {
    return ""
  }

  const data = parsed.data
  const lines = [
    "This user just completed onboarding. Use this context to personalize their first in-product guidance.",
    data.fullName ? `Name: ${data.fullName}` : null,
    `Role: ${ROLE_LABELS[data.role]}`,
    `Team size: ${TEAM_SIZE_LABELS[data.teamSize]}`,
    `Main goals: ${data.creationGoals.map((goal) => CREATION_GOAL_LABELS[goal]).join(", ")}`,
    `AI experience: ${AI_EXPERIENCE_LABELS[data.aiExperience]}`,
    `Top priority: ${data.priorities.map((priority) => PRIORITY_LABELS[priority]).join(", ")}`,
    `Referral source: ${REFERRAL_SOURCE_LABELS[data.referralSource]}`,
    "Guide them toward the best first actions in UniCan, but do not repeat this profile back unless it helps answer the user directly.",
  ]

  return lines.filter((line): line is string => Boolean(line)).join("\n")
}
