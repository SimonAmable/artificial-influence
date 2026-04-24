import { z } from "zod"
import {
  onboardingAiExperienceSchema,
  onboardingCreationGoalSchema,
  onboardingJsonDataSchema,
  onboardingPrioritySchema,
  onboardingReferralSourceSchema,
  onboardingRoleSchema,
  onboardingTeamSizeSchema,
} from "@/lib/onboarding/payload-schema"

type OnboardingRole = z.infer<typeof onboardingRoleSchema>
type OnboardingTeamSize = z.infer<typeof onboardingTeamSizeSchema>
type OnboardingCreationGoal = z.infer<typeof onboardingCreationGoalSchema>
type OnboardingAiExperience = z.infer<typeof onboardingAiExperienceSchema>
type OnboardingPriority = z.infer<typeof onboardingPrioritySchema>
type OnboardingReferralSource = z.infer<typeof onboardingReferralSourceSchema>

const ROLE_LABELS: Record<OnboardingRole, string> = {
  founder: "Founder",
  product: "Product",
  designer: "Designer",
  engineer: "Engineer",
  consultant: "Consultant",
  marketing_sales: "Marketing / Sales",
  operations: "Operations",
  other: "Other",
}

const TEAM_SIZE_LABELS: Record<OnboardingTeamSize, string> = {
  solo: "Solo",
  "2-20": "2-20 people",
  "21-200": "21-200 people",
  "200+": "200+ people",
}

const CREATION_GOAL_LABELS: Record<OnboardingCreationGoal, string> = {
  ai_ugc: "AI UGC",
  ai_influencer_content: "AI influencer content",
  automated_tiktok_instagram: "TikTok / Instagram automation",
  memes_brainrot: "Memes / brainrot content",
  motion_control_videos: "Motion videos",
  product_ads: "Product ads",
  artistic_cinematic: "Cinematic / artistic work",
  other: "Other creative work",
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
    `Top priorities: ${data.priorities.map((priority) => PRIORITY_LABELS[priority]).join(", ")}`,
    `Referral source: ${REFERRAL_SOURCE_LABELS[data.referralSource]}`,
    "Guide them toward the best first actions in UniCan, but do not repeat this profile back unless it helps answer the user directly.",
  ]

  return lines.filter((line): line is string => Boolean(line)).join("\n")
}
