"use client"

import { SignOut } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { ONBOARDING_DONE_COOKIE } from "@/lib/onboarding/constants"
import { clearOnboardingCompletedLocal } from "@/lib/onboarding/client-storage"
import { cn } from "@/lib/utils"

type ProfileLogoutButtonProps = {
  userId?: string
  variant?: "page" | "modal"
  onLoggedOut?: () => void
}

export function ProfileLogoutButton({
  userId,
  variant = "modal",
  onLoggedOut,
}: ProfileLogoutButtonProps) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  const handleLogout = async () => {
    setPending(true)
    try {
      clearOnboardingCompletedLocal(userId)
      if (typeof document !== "undefined") {
        document.cookie = `${ONBOARDING_DONE_COOKIE}=; path=/; max-age=0`
      }
      const supabase = createClient()
      await supabase.auth.signOut()
      onLoggedOut?.()
      router.push("/")
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant="destructive"
      disabled={pending}
      className={cn(variant === "modal" && "rounded-full")}
      onClick={() => void handleLogout()}
    >
      <SignOut className="mr-2 h-4 w-4" />
      {pending ? "Signing out…" : "Log out"}
    </Button>
  )
}
