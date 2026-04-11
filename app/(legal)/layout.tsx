import type { ReactNode } from "react"

export const dynamic = "force-static"

export default function LegalSectionLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background pt-24 pb-16 md:pt-28 md:pb-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">{children}</div>
    </main>
  )
}
