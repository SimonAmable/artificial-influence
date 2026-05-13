/** HttpOnly false so client can clear on logout; value must equal `auth.users.id` when complete. */
export const ONBOARDING_DONE_COOKIE = "onboarding_done" as const

export const onboardingLocalStorageKey = (userId: string) =>
  `onboarding:v1:${userId}` as const

/** SessionStorage: step index to restore after Instagram/TikTok OAuth returns to `/onboarding`. */
export const onboardingOAuthResumeStepKey = (userId: string) =>
  `onboarding:oauth-resume-step:v1:${userId}` as const
