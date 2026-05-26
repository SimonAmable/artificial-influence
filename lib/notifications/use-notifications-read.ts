"use client"

import * as React from "react"

import {
  getLatestProductUpdatePublishedAt,
  hasUnreadProductUpdates,
} from "@/lib/constants/product-updates"
import { createClient } from "@/lib/supabase/client"

const STORAGE_KEY_PREFIX = "product-updates-last-seen-at"

const listeners = new Set<() => void>()

function notifyListeners() {
  for (const listener of listeners) {
    listener()
  }
}

function storageKeyForUser(userId: string | null): string {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX
}

function readLastSeenAt(userId: string | null): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(storageKeyForUser(userId))
  } catch {
    return null
  }
}

function writeLastSeenAt(userId: string | null, value: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKeyForUser(userId), value)
  } catch {
    // ignore quota / private mode
  }
}

export function useNotificationsRead() {
  const [userId, setUserId] = React.useState<string | null>(null)
  const [lastSeenAt, setLastSeenAt] = React.useState<string | null>(null)
  const [hydrated, setHydrated] = React.useState(false)

  const refreshLastSeen = React.useCallback(() => {
    setLastSeenAt(readLastSeenAt(userId))
  }, [userId])

  React.useEffect(() => {
    let cancelled = false

    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return

      const id = user?.id ?? null
      setUserId(id)
      setLastSeenAt(readLastSeenAt(id))
      setHydrated(true)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    listeners.add(refreshLastSeen)
    return () => {
      listeners.delete(refreshLastSeen)
    }
  }, [refreshLastSeen])

  const hasUnread = hydrated && hasUnreadProductUpdates(lastSeenAt)

  const markSeen = React.useCallback(async () => {
    const latest = getLatestProductUpdatePublishedAt()
    if (!latest) return

    let id = userId
    if (!id) {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      id = user?.id ?? null
      if (id) setUserId(id)
    }

    setLastSeenAt(latest)
    writeLastSeenAt(id, latest)
    notifyListeners()
  }, [userId])

  return { hasUnread, markSeen, hydrated }
}
