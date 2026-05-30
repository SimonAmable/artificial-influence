import "server-only"

import { createHash } from "crypto"

export type PinterestImportCandidate = {
  id: string
  title: string | null
  description: string | null
  previewUrl: string
  sourceUrl: string
  width: number | null
  height: number | null
  tags: string[]
}

const ACTOR_SLUG = process.env.APIFY_PINTEREST_ACTOR_ID?.trim() || "thirdwatch/pinterest-scraper"
const APIFY_BASE = "https://api.apify.com/v2"

function requireApifyToken() {
  const token = process.env.APIFY_API_TOKEN?.trim()
  if (!token) {
    throw new Error("Pinterest import isn't available right now. Please try again later.")
  }
  return token
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function readStringList(record: Record<string, unknown>, key: string) {
  const value = record[key]
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim())
}

function normalizeActorPath(slug: string) {
  return encodeURIComponent(slug.replace("/", "~"))
}

function makeCandidateId(sourceUrl: string, previewUrl: string) {
  return createHash("sha1").update(`${sourceUrl}\n${previewUrl}`).digest("hex").slice(0, 24)
}

function normalizeCandidate(raw: unknown): PinterestImportCandidate | null {
  if (!isRecord(raw)) return null

  const previewUrl = readString(raw, "image_url")
  const sourceUrl =
    readString(raw, "pin_url") ??
    readString(raw, "link") ??
    readString(raw, "url") ??
    previewUrl
  if (!previewUrl || !sourceUrl) return null

  return {
    id: makeCandidateId(sourceUrl, previewUrl),
    title: readString(raw, "title"),
    description: readString(raw, "description"),
    previewUrl,
    sourceUrl,
    width: readNumber(raw, "width"),
    height: readNumber(raw, "height"),
    tags: readStringList(raw, "tags").slice(0, 20),
  }
}

function dedupeCandidates(candidates: PinterestImportCandidate[]) {
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = `${candidate.previewUrl}::${candidate.sourceUrl}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function runPinterestActor(input: Record<string, unknown>) {
  const token = requireApifyToken()
  const actorPath = normalizeActorPath(ACTOR_SLUG)
  const response = await fetch(
    `${APIFY_BASE}/acts/${actorPath}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const message = await response.text().catch(() => "")
    throw new Error(message || "Pinterest import failed.")
  }

  const json = (await response.json()) as unknown
  if (!Array.isArray(json)) {
    throw new Error("Pinterest import returned an unexpected response.")
  }

  return dedupeCandidates(json.map(normalizeCandidate).filter((candidate): candidate is PinterestImportCandidate => Boolean(candidate)))
}

export async function searchPinterestPins(query: string, limit: number) {
  return runPinterestActor({
    searchQueries: [query],
    maxResults: limit,
  })
}

export async function scrapePinterestBoard(boardUrl: string, limit: number) {
  return runPinterestActor({
    boardUrls: [boardUrl],
    maxResults: limit,
  })
}
