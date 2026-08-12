const STORAGE_KEY = "terms-acceptance-gate-v1"

export type TermsGateCachedStatus = {
  needsAcceptance: boolean
  reason: "missing" | "outdated" | null
  acceptedAt: string | null
  acceptedVersion: string | null
  currentTerms: {
    title: string
    version: string
    lastUpdated: string | null
    content: string
    contentPreview: string
  }
}

type StoredTermsGate = {
  userId: string
  termsVersion: string
  status: TermsGateCachedStatus
}

export function readTermsGateCache(
  userId: string,
  termsVersion: string
): TermsGateCachedStatus | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as StoredTermsGate
    if (parsed.userId !== userId || parsed.termsVersion !== termsVersion) {
      return null
    }

    return parsed.status
  } catch {
    return null
  }
}

export function writeTermsGateCache(
  userId: string,
  termsVersion: string,
  status: TermsGateCachedStatus
): void {
  if (typeof window === "undefined") return

  try {
    const payload: StoredTermsGate = { userId, termsVersion, status }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function clearTermsGateCache(): void {
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors.
  }
}
