import fs from 'fs'
import path from 'path'

let cached: string | null = null

/**
 * Reads `affiliate-program-agreement.md` from disk (server-only).
 * Cached per process. Used for onboarding UI and `affiliates.agreed_terms_text`.
 */
export function getAffiliateProgramAgreementText(): string {
  if (cached !== null) {
    return cached
  }
  const filePath = path.join(
    process.cwd(),
    'lib/affiliate/affiliate-program-agreement.md'
  )
  cached = fs.readFileSync(filePath, 'utf-8')
  return cached
}
