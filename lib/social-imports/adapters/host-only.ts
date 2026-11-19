import type { SocialImportAdapter, SocialPlatform } from "../types"

export function createHostOnlyAdapter(
  platform: SocialPlatform,
  hostMatchers: RegExp[],
  userMessage: string,
): SocialImportAdapter {
  return {
    platform,
    matches(url) {
      const host = url.hostname.replace(/^www\./i, "").toLowerCase()
      return hostMatchers.some((re) => re.test(host))
    },
    async inspect() {
      throw new Error(userMessage)
    },
  }
}

export const threadsAdapter = createHostOnlyAdapter(
  "threads",
  [/^threads\.net$/i],
  "Threads import isn't enabled on this deployment yet. Try upload instead.",
)

export const youtubeShortsAdapter = createHostOnlyAdapter(
  "youtube_shorts",
  [/^youtube\.com$/i, /^youtu\.be$/i, /^m\.youtube\.com$/i],
  "YouTube Shorts import isn't enabled on this deployment yet. Try upload instead.",
)

export const xAdapter = createHostOnlyAdapter(
  "x",
  [/^x\.com$/i, /^twitter\.com$/i, /^mobile\.twitter\.com$/i],
  "X (Twitter) import isn't enabled on this deployment yet. Try upload instead.",
)

export const redditAdapter = createHostOnlyAdapter(
  "reddit",
  [/^reddit\.com$/i, /^old\.reddit\.com$/i, /^www\.reddit\.com$/i],
  "Reddit import isn't enabled on this deployment yet. Try upload instead.",
)

export const facebookAdapter = createHostOnlyAdapter(
  "facebook",
  [/^facebook\.com$/i, /^m\.facebook\.com$/i, /^fb\.watch$/i],
  "Facebook import isn't enabled on this deployment yet. Try upload instead.",
)

export const pinterestAdapter = createHostOnlyAdapter(
  "pinterest",
  [/^pinterest\.com$/i, /^pin\.it$/i],
  "Pinterest import isn't enabled on this deployment yet. Try upload instead.",
)

export const redgifsAdapter = createHostOnlyAdapter(
  "redgifs",
  [/^redgifs\.com$/i, /^www\.redgifs\.com$/i],
  "RedGifs import isn't enabled on this deployment yet. Try upload instead.",
)