/**
 * Optional Phase 2: swap in a hosted reader (Firecrawl, Jina Reader, etc.) when
 * Phase 1 returns empty or low-quality HTML. Not wired by default — set env and
 * implement the fetcher for your vendor of choice.
 */
export async function maybeFetchReaderMarkdown(_url: string): Promise<string | null> {
  if (!process.env.BRAND_ANALYZE_READER_URL || !process.env.BRAND_ANALYZE_READER_KEY) {
    return null
  }
  // Placeholder: integrate your reader API here and return markdown or null.
  return null
}
