import { onboardingLocalStorageKey } from "@/lib/onboarding/constants"

export function setOnboardingCompletedLocal(userId: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(onboardingLocalStorageKey(userId), "1")
  } catch {
    // ignore quota / private mode
  }
}

export function clearOnboardingCompletedLocal(userId?: string) {
  if (typeof window === "undefined") return
  try {
    if (userId) {
      localStorage.removeItem(onboardingLocalStorageKey(userId))
      return
    }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith("onboarding:v1:")) localStorage.removeItem(k)
    }
  } catch {
    // ignore
  }
}

export function isOnboardingCompletedLocal(userId: string) {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(onboardingLocalStorageKey(userId)) === "1"
  } catch {
    return false
  }
}
