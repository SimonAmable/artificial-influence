"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { createClient } from "@/lib/supabase/client"

const MESSAGE_TYPE = "UNICAN_EXTENSION_SET_SESSION"

type ChromeRuntime = {
  runtime?: {
    sendMessage?: (
      extensionId: string,
      message: unknown,
      callback?: (response: unknown) => void,
    ) => void
    lastError?: { message?: string }
  }
}

function getChromeRuntime(): ChromeRuntime["runtime"] | null {
  if (typeof window === "undefined") return null
  const chromeApi = (window as Window & { chrome?: ChromeRuntime }).chrome
  return chromeApi?.runtime ?? null
}

export function ExtensionConnectClient() {
  const searchParams = useSearchParams()
  const extensionId = searchParams.get("extension_id")
  const [status, setStatus] = React.useState("Connecting extension…")

  React.useEffect(() => {
    let cancelled = false

    void (async () => {
      if (!extensionId) {
        setStatus("Missing extension id. Open this page from the UniCan extension.")
        return
      }

      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        const next = `/extension/connect?extension_id=${encodeURIComponent(extensionId)}`
        window.location.href = `/login?next=${encodeURIComponent(next)}`
        return
      }

      const runtime = getChromeRuntime()
      if (!runtime?.sendMessage) {
        setStatus("Chrome extension API unavailable. Use Chrome and open this from the extension.")
        return
      }

      await new Promise<void>((resolve, reject) => {
        runtime.sendMessage?.(
          extensionId,
          {
            type: MESSAGE_TYPE,
            session: {
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
              expiresAt: session.expires_at ? session.expires_at * 1000 : Date.now() + 3_600_000,
              userEmail: session.user.email ?? null,
            },
          },
          (response) => {
            if (runtime.lastError?.message) {
              reject(new Error(runtime.lastError.message))
              return
            }

            const payload = response as { ok?: boolean } | undefined
            if (!payload?.ok) {
              reject(new Error("Extension did not accept the session."))
              return
            }

            resolve()
          },
        )
      })

      if (!cancelled) {
        setStatus("Connected. Return to the UniCan side panel.")
      }
    })().catch((error) => {
      if (!cancelled) {
        setStatus(error instanceof Error ? error.message : "Could not connect extension.")
      }
    })

    return () => {
      cancelled = true
    }
  }, [extensionId])

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-2xl font-bold uppercase tracking-tight">Extension Connect</h1>
      <p className="mt-3 text-sm text-muted-foreground">{status}</p>
    </main>
  )
}
