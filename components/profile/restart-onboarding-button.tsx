"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { restartOnboarding } from "@/app/profile/actions"
import { Button } from "@/components/ui/button"
import { clearOnboardingCompletedLocal } from "@/lib/onboarding/client-storage"

export function RestartOnboardingButton({ userId }: { userId: string }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  const onClick = () => {
    setPending(true)
    void (async () => {
      try {
        const result = await restartOnboarding()
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        clearOnboardingCompletedLocal(userId)
        router.push("/onboarding")
        router.refresh()
      } finally {
        setPending(false)
      }
    })()
  }

  return (
    <Button type="button" variant="outline" disabled={pending} onClick={onClick}>
      {pending ? "Restarting…" : "Restart onboarding"}
    </Button>
  )
}
