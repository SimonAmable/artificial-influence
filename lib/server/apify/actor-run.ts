import "server-only"

const APIFY_BASE = "https://api.apify.com/v2"

type ApifyRunResponse = {
  data?: {
    id?: string
    status?: string
    defaultDatasetId?: string
    statusMessage?: string
  }
  error?: { type?: string; message?: string }
}

export function requireApifyToken() {
  const token = process.env.APIFY_API_TOKEN?.trim()
  if (!token) {
    throw new Error("Social import isn't available right now. Please try again later.")
  }
  return token
}

export function normalizeApifyActorPath(actorSlug: string) {
  return encodeURIComponent(actorSlug.replace("/", "~"))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function parseJson(response: Response) {
  return (await response.json()) as unknown
}

async function fetchDatasetItems(datasetId: string, token: string): Promise<unknown[]> {
  const url = new URL(`${APIFY_BASE}/datasets/${datasetId}/items`)
  url.searchParams.set("format", "json")

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  const payload = await parseJson(response)

  if (!response.ok) {
    throw new Error("Couldn't load Apify results. Please try again.")
  }

  if (Array.isArray(payload)) {
    return payload
  }

  if (isRecord(payload) && Array.isArray(payload.items)) {
    return payload.items
  }

  if (isRecord(payload) && isRecord(payload.data) && Array.isArray(payload.data.items)) {
    return payload.data.items as unknown[]
  }

  return []
}

/**
 * Starts an Apify actor run and waits up to waitSeconds before reading dataset items.
 */
export async function runApifyActorSync(
  actorSlug: string,
  input: Record<string, unknown>,
  waitSeconds = 300,
) {
  const token = requireApifyToken()
  const actorPath = normalizeApifyActorPath(actorSlug)
  const url = new URL(`${APIFY_BASE}/acts/${actorPath}/runs`)
  url.searchParams.set("waitForFinish", String(waitSeconds))

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  })

  const body = (await parseJson(response)) as ApifyRunResponse

  if (!response.ok) {
    throw new Error("Couldn't fetch content from that link. Please try again.")
  }

  const data = body.data
  if (!data) {
    throw new Error("Couldn't fetch content from that link. Please try again.")
  }

  if (data.status !== "SUCCEEDED") {
    const detail = data.statusMessage?.trim()
    throw new Error(
      detail && detail.length < 200
        ? detail
        : "That post couldn't be fetched. It may be private or restricted.",
    )
  }

  const datasetId = data.defaultDatasetId
  if (!datasetId) {
    throw new Error("No media was returned for that link.")
  }

  const items = await fetchDatasetItems(datasetId, token)
  return { runId: data.id ?? null, datasetId, items }
}