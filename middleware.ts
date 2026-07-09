import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

function isMcpApiRequest(request: NextRequest) {
  if (request.method === "POST") return true

  const accept = request.headers.get("accept") ?? ""
  if (request.headers.has("authorization")) return true
  if (accept.includes("text/event-stream")) return true
  if (accept.includes("application/json") && !accept.includes("text/html")) return true

  return false
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/mcp") {
    return NextResponse.next()
  }

  if (isMcpApiRequest(request)) {
    return NextResponse.rewrite(new URL("/api/mcp", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/mcp",
}
