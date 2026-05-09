import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { loadLegalDoc } from "@/lib/legal/load-legal-doc"

export const TERMS_VERSION_COOKIE = "terms_version" as const

export type TermsAcceptanceSource = "onboarding" | "blocking_modal"

export type CurrentTermsDocument = {
  title: string
  version: string
  lastUpdated: string | null
  content: string
}

export type TermsAcceptanceStatus = {
  needsAcceptance: boolean
  reason: "missing" | "outdated" | null
  acceptedAt: string | null
  acceptedVersion: string | null
  currentTerms: CurrentTermsDocument & {
    contentPreview: string
  }
}

let cachedCurrentTerms: CurrentTermsDocument | null = null

export function getTermsVersionCookieOptions() {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  }
}

/** Use in Route Handlers so Set-Cookie is attached to the returned response. */
export function applyTermsVersionCookieToResponse(response: NextResponse, version: string): void {
  response.cookies.set(TERMS_VERSION_COOKIE, version, getTermsVersionCookieOptions())
}

export function clearTermsVersionCookieOnResponse(response: NextResponse): void {
  response.cookies.set(TERMS_VERSION_COOKIE, "", {
    ...getTermsVersionCookieOptions(),
    maxAge: 0,
  })
}

function previewTerms(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .slice(0, 3)
    .join(" ")
}

function normalizeFrontmatterString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (typeof value === "number") {
    return String(value)
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  return null
}

export function getCurrentTermsDocument(): CurrentTermsDocument {
  if (cachedCurrentTerms) {
    return cachedCurrentTerms
  }

  const { data, content } = loadLegalDoc("terms")
  const version = normalizeFrontmatterString(data.version)
  const lastUpdated = normalizeFrontmatterString(data.lastUpdated)

  if (!version) {
    throw new Error('content/legal/terms.md is missing required frontmatter field "version".')
  }

  cachedCurrentTerms = {
    title: data.title,
    version,
    lastUpdated,
    content,
  }

  return cachedCurrentTerms
}

export async function getTermsAcceptanceStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<TermsAcceptanceStatus> {
  const currentTerms = getCurrentTermsDocument()
  const { data, error } = await supabase
    .from("profiles")
    .select("terms_accepted_at, terms_version")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const acceptedAt =
    typeof data?.terms_accepted_at === "string" ? data.terms_accepted_at : null
  const acceptedVersion =
    typeof data?.terms_version === "string" ? data.terms_version : null

  let reason: TermsAcceptanceStatus["reason"] = null
  if (!acceptedAt || !acceptedVersion) {
    reason = "missing"
  } else if (acceptedVersion !== currentTerms.version) {
    reason = "outdated"
  }

  return {
    needsAcceptance: reason !== null,
    reason,
    acceptedAt,
    acceptedVersion,
    currentTerms: {
      title: currentTerms.title,
      version: currentTerms.version,
      lastUpdated: currentTerms.lastUpdated,
      content: currentTerms.content,
      contentPreview: previewTerms(currentTerms.content),
    },
  }
}

export async function setTermsVersionCookie(version: string) {
  const cookieStore = await cookies()
  cookieStore.set(TERMS_VERSION_COOKIE, version, getTermsVersionCookieOptions())
}

export async function clearTermsVersionCookie() {
  const cookieStore = await cookies()
  cookieStore.set(TERMS_VERSION_COOKIE, "", {
    ...getTermsVersionCookieOptions(),
    maxAge: 0,
  })
}

export async function recordCurrentTermsAcceptance(
  supabase: SupabaseClient,
  userId: string,
  source: TermsAcceptanceSource
) {
  const currentTerms = getCurrentTermsDocument()
  const acceptedAt = new Date().toISOString()

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      terms_accepted_at: acceptedAt,
      terms_version: currentTerms.version,
      terms_text_snapshot: currentTerms.content,
      terms_acceptance_source: source,
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!updated) {
    throw new Error("Profile update affected no rows.")
  }

  return {
    acceptedAt,
    currentTerms,
  }
}
