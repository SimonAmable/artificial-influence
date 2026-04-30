/*
 * LEGACY SANDBOX CLI ENTRYPOINT - NOT IN USE
 *
 * Retained for fallback/reference from the earlier custom sandbox worker path.
 * The active render flow now runs through @remotion/vercel from the Next.js app.
 */
import { processRenderJob } from "./render-job"

async function main() {
  const renderJobId = process.argv[2]

  if (!renderJobId) {
    throw new Error("Usage: npm run render:job -- <renderJobId>")
  }

  await processRenderJob(renderJobId)
}

main().catch((error) => {
  console.error("[remotion-renderer] run-job failed:", error)
  process.exitCode = 1
})
