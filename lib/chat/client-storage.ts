"use client"

const SIDEBAR_THREAD_KEY_PREFIX = "chat:v1:sidebar-thread:"

function sidebarThreadStorageKey(userId: string) {
  return `${SIDEBAR_THREAD_KEY_PREFIX}${userId}`
}

export function getStoredSidebarThreadId(userId: string): string | null {
  try {
    return localStorage.getItem(sidebarThreadStorageKey(userId))
  } catch {
    return null
  }
}

export function setStoredSidebarThreadId(userId: string, threadId: string) {
  try {
    localStorage.setItem(sidebarThreadStorageKey(userId), threadId)
  } catch {
    // Ignore storage failures and keep chat usable.
  }
}

export function clearStoredSidebarThreadId(userId: string) {
  try {
    localStorage.removeItem(sidebarThreadStorageKey(userId))
  } catch {
    // Ignore storage failures and keep chat usable.
  }
}
