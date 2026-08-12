import type { Metadata } from "next"

import { ExtensionAuthPanel } from "@/components/extension/extension-auth-panel"
import { RecreateExtensionPanel } from "@/components/extension/recreate-extension-panel"
import { FancyButtonsShowcase } from "./fancy-buttons-showcase"

export const metadata: Metadata = {
  title: "Testing",
}

export default function TestingPage() {
  return (
    <div className="flex flex-col gap-16 p-8">
      <section className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
          Recreate Extension
        </h1>
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Before auth
            </p>
            <ExtensionAuthPanel />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Signed in
            </p>
            <RecreateExtensionPanel />
          </div>
        </div>
      </section>
      <FancyButtonsShowcase />
    </div>
  )
}
