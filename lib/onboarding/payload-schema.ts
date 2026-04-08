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

export const completeOnboardingPayloadSchema = z.object({
  theme: onboardingThemeSchema,
  fullName: z.string().trim().min(1, "Enter your name").max(200),
  teamSize: onboardingTeamSizeSchema,
  role: onboardingRoleSchema,
})

export type CompleteOnboardingPayload = z.infer<typeof completeOnboardingPayloadSchema>

/** Persisted in profiles.onboarding_json_data (metrics + profile fields snapshot). */
export const onboardingJsonDataSchema = completeOnboardingPayloadSchema.extend({
  completedAt: z.string().datetime(),
})

export type OnboardingJsonData = z.infer<typeof onboardingJsonDataSchema>
