const GRAPH_HOST = "https://graph.instagram.com"

export function getInstagramGraphVersion() {
  return process.env.INSTAGRAM_GRAPH_API_VERSION?.trim() || "v22.0"
}

type MetaErrorBody = {
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

export class InstagramGraphError extends Error {
  readonly code?: number
  readonly type?: string

  constructor(message: string, code?: number, type?: string) {
    super(message)
    this.name = "InstagramGraphError"
    this.code = code
    this.type = type
  }
}

export async function instagramGraphGet<T>(
  nodeId: string,
  accessToken: string,
  pathSuffix: string
): Promise<T> {
  const version = getInstagramGraphVersion()
  const url = new URL(`${GRAPH_HOST}/${version}/${nodeId}${pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`}`)
  url.searchParams.set("access_token", accessToken)

  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" })
  const data = (await response.json()) as T & MetaErrorBody

  if (!response.ok || data.error) {
    const msg = data.error?.message || "Instagram API request failed."
    throw new InstagramGraphError(msg, data.error?.code, data.error?.type)
  }

  return data
}

export async function instagramGraphPostJson<T>(
  instagramUserId: string,
  accessToken: string,
  edge: string,
  body: Record<string, unknown>
): Promise<T> {
  const version = getInstagramGraphVersion()
  const url = `${GRAPH_HOST}/${version}/${instagramUserId}/${edge.replace(/^\//, "")}`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  const data = (await response.json()) as T & MetaErrorBody

  if (!response.ok || data.error) {
    const msg = data.error?.message || "Instagram API request failed."
    throw new InstagramGraphError(msg, data.error?.code, data.error?.type)
  }

  return data
}
