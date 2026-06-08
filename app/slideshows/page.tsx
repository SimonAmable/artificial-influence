import * as React from "react"
import { SlideshowsPage } from "@/components/slideshows/slideshows-page"

export const metadata = {
  title: "Slideshows",
  description: "Create reusable AI and collection-powered slideshows.",
}

export default function Page() {
  return (
    <React.Suspense fallback={<div className="px-6 py-24 text-sm text-muted-foreground">Loading slideshows...</div>}>
      <SlideshowsPage />
    </React.Suspense>
  )
}
