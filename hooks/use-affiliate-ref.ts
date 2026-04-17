'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export const AFFILIATE_REF_STORAGE_KEY = 'ai_affiliate_ref'

export type StoredAffiliateRef = {
  code: string
  ts: number
}

export function getStoredAffiliateRef(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AFFILIATE_REF_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAffiliateRef
    return typeof parsed.code === 'string' ? parsed.code : null
  } catch {
    return null
  }
}

/**
 * Captures `?ref=` on first visit (first-click wins) and stores lowercase code in localStorage.
 */
export function useAffiliateRefCapture() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (!ref) return

    const normalized = ref.trim().toLowerCase()
    if (!/^[a-z0-9]{4,20}$/.test(normalized)) return

    try {
      const existing = localStorage.getItem(AFFILIATE_REF_STORAGE_KEY)
      if (existing) return

      const payload: StoredAffiliateRef = {
        code: normalized,
        ts: Date.now(),
      }
      localStorage.setItem(AFFILIATE_REF_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // storage blocked
    }
  }, [searchParams])
}
