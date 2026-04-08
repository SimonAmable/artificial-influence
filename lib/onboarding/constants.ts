/** HttpOnly false so client can clear on logout; value must equal `auth.users.id` when complete. */
export const ONBOARDING_DONE_COOKIE = "onboarding_done" as const

export const onboardingLocalStorageKey = (userId: string) =>
  `onboarding:v1:${userId}` as const
