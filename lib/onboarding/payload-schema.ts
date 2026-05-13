import { z } from "zod"

export const onboardingThemeSchema = z.enum(["light", "dark"])

export const onboardingTeamSizeSchema = z.enum(["solo", "2-20", "21-200", "200+"])

export const onboardingRoleSchema = z.enum([
  "ai_influencer",
  "ai_agency",
  "founder",
  "marketer",
  "creator",
  "other",
])

export type OnboardingRole = z.infer<typeof onboardingRoleSchema>

/**
 * Maps role strings from older onboarding payloads to the current enum so
 * `onboarding_json_data` and partial prefill still parse after the role list changed.
 */
export const LEGACY_ONBOARDING_ROLE_TO_NEW: Readonly<Record<string, OnboardingRole>> = {
  product: "marketer",
  designer: "creator",
  engineer: "other",
  consultant: "other",
  marketing_sales: "marketer",
  operations: "other",
}

function preprocessStoredOnboardingRole(input: unknown): unknown {
  if (typeof input !== "string") return input
  return LEGACY_ONBOARDING_ROLE_TO_NEW[input] ?? input
}

/** Parse a stored role string (including legacy values) into the current enum, or undefined. */
export function parseOnboardingRoleFromStorage(raw: unknown): OnboardingRole | undefined {
  if (typeof raw !== "string") return undefined
  const coerced = LEGACY_ONBOARDING_ROLE_TO_NEW[raw] ?? raw
  const parsed = onboardingRoleSchema.safeParse(coerced)
  return parsed.success ? parsed.data : undefined
}

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
    .min(1, "Pick one priority")
    .max(1, "Pick one priority"),
  aiInfluencer: onboardingInfluencerSchema.optional(),
  characterOnboarding: onboardingCharacterOnboardingSchema.optional(),
  acceptedTerms: z
    .boolean()
    .refine((value) => value === true, "You must accept the current Terms of Use."),
})

export type CompleteOnboardingPayload = z.infer<typeof completeOnboardingPayloadSchema>

/** Persisted in profiles.onboarding_json_data (metrics + profile fields snapshot). */
export const onboardingJsonDataSchema = completeOnboardingPayloadSchema
  .omit({ priorities: true, role: true })
  .extend({
    /** Legacy rows may include up to 3; new completions store exactly one. */
    priorities: z.array(onboardingPrioritySchema).min(1).max(3),
    role: z.preprocess(preprocessStoredOnboardingRole, onboardingRoleSchema),
    completedAt: z.string().datetime(),
  })

export type OnboardingJsonData = z.infer<typeof onboardingJsonDataSchema>
