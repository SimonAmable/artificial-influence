/*
 * LEGACY RAILWAY HTTP WORKER ENTRYPOINT - NOT IN USE
 *
 * Vercel Sandbox is now the primary render path.
 * This HTTP server is retained for fallback/reference only.
 */
import { createServer, type IncomingMessage } from "node:http"
import { WORKER_SECRET_HEADER } from "./constants"
import { processRenderJob } from "./render-job"

type RenderRequestBody = {
  renderJobId?: string
}

function json(
  body: Record<string, unknown>,
  statusCode = 200
): { body: string; statusCode: number; headers: Record<string, string> } {
  return {
    body: JSON.stringify(body),
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  }
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return {} as T
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T
}

const server = createServer(async (request, response) => {
  try {
    if (!request.url || !request.method) {
      const res = json({ error: "Bad request" }, 400)
      response.writeHead(res.statusCode, res.headers)
      response.end(res.body)
      return
    }

    const requestUrl = new URL(request.url, "http://localhost")

    if (request.method === "GET" && requestUrl.pathname === "/health") {
      const res = json({ ok: true })
      response.writeHead(res.statusCode, res.headers)
      response.end(res.body)
      return
    }

    if (request.method === "POST" && requestUrl.pathname === "/render") {
      const expectedSecret = process.env.WORKER_SHARED_SECRET
      const providedSecretHeader = request.headers[WORKER_SECRET_HEADER]
      const providedSecret = Array.isArray(providedSecretHeader)
        ? providedSecretHeader[0]
        : providedSecretHeader

      if (!expectedSecret || providedSecret !== expectedSecret) {
        const res = json({ error: "Unauthorized" }, 401)
        response.writeHead(res.statusCode, res.headers)
        response.end(res.body)
        return
      }

      const body = await readJsonBody<RenderRequestBody>(request)
      if (!body.renderJobId) {
        const res = json({ error: "Missing renderJobId" }, 400)
        response.writeHead(res.statusCode, res.headers)
        response.end(res.body)
        return
      }

      void processRenderJob(body.renderJobId).catch((error) => {
        console.error(
          `[remotion-renderer] Render failed for ${body.renderJobId}:`,
          error
        )
      })

      const res = json({ accepted: true, renderJobId: body.renderJobId }, 202)
      response.writeHead(res.statusCode, res.headers)
      response.end(res.body)
      return
    }

    const res = json({ error: "Not found" }, 404)
    response.writeHead(res.statusCode, res.headers)
    response.end(res.body)
  } catch (error) {
    console.error("[remotion-renderer] Unhandled request error:", error)
    const res = json({ error: "Internal server error" }, 500)
    response.writeHead(res.statusCode, res.headers)
    response.end(res.body)
  }
})

const port = Number(process.env.PORT || 3001)
server.listen(port, () => {
  console.log(`[remotion-renderer] listening on port ${port}`)
})
