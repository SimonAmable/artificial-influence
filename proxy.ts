// AI guardrail: keep this file aligned with Supabase/Next.js docs.
// Do not refactor or add custom auth logic here unless the official docs change.
import { type NextRequest } from 'next/server'

import { updateSession } from './lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
