import { z } from "zod"

export const onboardingThemeSchema = z.enum(["light", "dark"])

export const onboardingTeamSizeSchema = z.enum(["solo", "2-20", "21-200", "200+"])

export const onboardingRoleSchema = z.enum([
  "founder",
  "product",
  "designer",
  "engineer",
  "consultant",
  "marketing_sales",
  "operations",
  "other",
])

export const onboardingCreationGoalSchema = z.enum([
  "ai_influencer_content",
  "motion_control_videos",
  "product_ads",
  "social_media",
  "artistic",
  "memes",
  "professional",
  "other",
])

export const onboardingAiExperienceSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "expert",
])

export const onboardingReferralSourceSchema = z.enum([
  "tiktok",
  "youtube",
  "instagram",
  "twitter",
  "google",
  "friend",
  "reddit",
  "other",
])

export const onboardingPrioritySchema = z.enum([
  "video_quality",
  "generation_speed",
  "ease_of_use",
  "affordable_pricing",
  "creative_control",
  "unique_models",
])

export const completeOnboardingPayloadSchema = z.object({
  theme: onboardingThemeSchema,
  fullName: z.string().trim().min(1, "Enter your name").max(200),
  teamSize: onboardingTeamSizeSchema,
  role: onboardingRoleSchema,
  creationGoals: z
    .array(onboardingCreationGoalSchema)
    .min(1, "Select at least one goal"),
  aiExperience: onboardingAiExperienceSchema,
  referralSource: onboardingReferralSourceSchema,
  priorities: z
    .array(onboardingPrioritySchema)
    .min(1, "Pick at least one priority")
    .max(3, "Pick at most 3 priorities"),
  acceptedTerms: z
    .boolean()
    .refine((value) => value === true, "You must accept the current Terms of Use."),
})

export type CompleteOnboardingPayload = z.infer<typeof completeOnboardingPayloadSchema>

/** Persisted in profiles.onboarding_json_data (metrics + profile fields snapshot). */
export const onboardingJsonDataSchema = completeOnboardingPayloadSchema.extend({
  completedAt: z.string().datetime(),
})

export type OnboardingJsonData = z.infer<typeof onboardingJsonDataSchema>
