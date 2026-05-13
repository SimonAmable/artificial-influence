import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { githubRawUrlCandidates } from "@/lib/chat/skills/github-raw-url"
import { normalizeSkillDocumentText } from "@/lib/chat/skills/normalize-skill-upload"

const USER_AGENT = "DeepShadCN-SkillImporter/1.0"

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "text/plain,text/markdown;q=0.9,*/*;q=0.8",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(id)
  }
}

async function fetchFirstOk(candidates: string[]): Promise<Response | null> {
  let lastFail: Response | null = null
  for (const url of candidates) {
    try {
      const response = await fetchWithTimeout(url, 25_000)
      if (response.ok) {
        return response
      }
      lastFail = response
    } catch {
      continue
    }
  }
  if (lastFail && !lastFail.ok) {
    return lastFail
  }
  return null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const urlRaw = typeof body.url === "string" ? body.url.trim() : ""
    const candidates = githubRawUrlCandidates(urlRaw)
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "Enter a github.com repo link or raw.githubusercontent.com SKILL.md URL." },
        { status: 400 },
      )
    }

    const response = await fetchFirstOk(candidates)
    if (!response) {
      return NextResponse.json(
        { error: "Could not reach GitHub from this URL. Check the repo is public." },
        { status: 502 },
      )
    }

    const text = await response.text()

    const normalized = normalizeSkillDocumentText(text)
    if (!normalized.ok) {
      return NextResponse.json(
        { error: `Fetched file is not valid SKILL.md: ${normalized.error}` },
        { status: 422 },
      )
    }

    return NextResponse.json({
      fetchedUrl: response.url || candidates[0],
      skillDocument: normalized.skillDocument,
      slug: normalized.slug,
      description: normalized.description,
      body: normalized.body,
    })
  } catch (error) {
    console.error("[skills/import-github] POST exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
