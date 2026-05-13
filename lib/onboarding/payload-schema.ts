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
  "ugc_social",
  "ai_influencer",
  "product_ads",
  "memes_brainrot",
  "carousel_posts",
  "fashion_lifestyle",
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

export const onboardingInfluencerModeSchema = z.enum(["preset", "upload", "skip"])

/** Whether the user saved a hero character during onboarding or skipped that step. */
export const onboardingCharacterOnboardingSchema = z.enum(["saved", "skipped"])

/** Stored on `onboarding_json_data.aiInfluencer` when the user picks AI Influencers. */
export const onboardingInfluencerSchema = z
  .object({
    mode: onboardingInfluencerModeSchema,
    presetId: z.string().trim().min(1).max(120).optional(),
    assetIds: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "preset" && !value.presetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick a preset character",
        path: ["presetId"],
      })
    }
    if (value.mode === "upload" && (!value.assetIds || value.assetIds.length < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Upload at least one reference asset",
        path: ["assetIds"],
      })
    }
  })

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
  aiInfluencer: onboardingInfluencerSchema.optional(),
  characterOnboarding: onboardingCharacterOnboardingSchema.optional(),
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
