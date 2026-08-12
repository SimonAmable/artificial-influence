import { Suspense } from "react"
import type { Metadata } from "next"

import { ExtensionConnectClient } from "@/components/extension/extension-connect-client"

export const metadata: Metadata = {
  title: "Connect Extension",
}

export default function ExtensionConnectPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-muted-foreground">Connecting extension…</main>}>
      <ExtensionConnectClient />
    </Suspense>
  )
}
