import { Suspense } from "react"
import { AutopostPage } from "@/components/autopost/autopost-page"

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AutopostPage />
    </Suspense>
  )
}
