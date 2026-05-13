import {
  onboardingAiExperienceSchema,
  onboardingCharacterOnboardingSchema,
  onboardingCreationGoalSchema,
  onboardingInfluencerSchema,
  onboardingPrioritySchema,
  onboardingReferralSourceSchema,
  parseOnboardingRoleFromStorage,
  onboardingTeamSizeSchema,
  onboardingThemeSchema,
  type CompleteOnboardingPayload,
} from "@/lib/onboarding/payload-schema"

/**
 * Maps persisted `profiles.onboarding_json_data` (or legacy shapes) into form state.
 * Each field is validated independently so enum/option changes do not break the page:
 * unknown values are dropped instead of failing the whole object.
 */
export function parseStoredOnboardingPrefill(
  raw: unknown
): Partial<CompleteOnboardingPayload> {
  const out: Partial<CompleteOnboardingPayload> = {}
  if (raw === null || typeof raw !== "object") return out

  const record = raw as Record<string, unknown>

  if (typeof record.fullName === "string") {
    const t = record.fullName.trim()
    if (t.length > 0 && t.length <= 200) {
      out.fullName = t
    }
  }

  const team = onboardingTeamSizeSchema.safeParse(record.teamSize)
  if (team.success) out.teamSize = team.data

  const role = parseOnboardingRoleFromStorage(record.role)
  if (role !== undefined) out.role = role

  const ai = onboardingAiExperienceSchema.safeParse(record.aiExperience)
  if (ai.success) out.aiExperience = ai.data

  const ref = onboardingReferralSourceSchema.safeParse(record.referralSource)
  if (ref.success) out.referralSource = ref.data

  const theme = onboardingThemeSchema.safeParse(record.theme)
  if (theme.success) out.theme = theme.data

  if (Array.isArray(record.creationGoals)) {
    const seen = new Set<string>()
    const goals: CompleteOnboardingPayload["creationGoals"] = []
    for (const item of record.creationGoals) {
      const parsed = onboardingCreationGoalSchema.safeParse(item)
      if (parsed.success && !seen.has(parsed.data)) {
        seen.add(parsed.data)
        goals.push(parsed.data)
      }
    }
    if (goals.length > 0) {
      out.creationGoals = goals
    }
  }

  if (Array.isArray(record.priorities)) {
    const seen = new Set<string>()
    const priorities: CompleteOnboardingPayload["priorities"] = []
    for (const item of record.priorities) {
      const parsed = onboardingPrioritySchema.safeParse(item)
      if (parsed.success && !seen.has(parsed.data)) {
        seen.add(parsed.data)
        priorities.push(parsed.data)
        if (priorities.length >= 1) break
      }
    }
    if (priorities.length > 0) {
      out.priorities = priorities
    }
  }

  const influencer = onboardingInfluencerSchema.safeParse(record.aiInfluencer)
  if (influencer.success) {
    out.aiInfluencer = influencer.data
  }

  const characterOnboarding = onboardingCharacterOnboardingSchema.safeParse(
    record.characterOnboarding
  )
  if (characterOnboarding.success) {
    out.characterOnboarding = characterOnboarding.data
  }

  return out
}
