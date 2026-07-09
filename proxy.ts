// AI guardrail: keep this file aligned with Supabase/Next.js docs.
// Do not refactor or add custom auth logic here unless the official docs change.
import { NextResponse, type NextRequest } from 'next/server'

import { updateSession } from './lib/supabase/proxy'

function isMcpApiRequest(request: NextRequest) {
  if (request.method === 'POST') return true

  const accept = request.headers.get('accept') ?? ''
  if (request.headers.has('authorization')) return true
  if (accept.includes('text/event-stream')) return true
  if (accept.includes('application/json') && !accept.includes('text/html')) return true

  return false
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/mcp' && isMcpApiRequest(request)) {
    return NextResponse.rewrite(new URL('/api/mcp', request.url))
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/generate-image/status|api/generate-video/status|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
