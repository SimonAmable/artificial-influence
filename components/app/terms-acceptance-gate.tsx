"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import {
  clearTermsGateCache,
  readTermsGateCache,
  writeTermsGateCache,
  type TermsGateCachedStatus,
} from "@/lib/legal/terms-acceptance-client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type TermsAcceptanceGateProps = {
  currentTermsVersion: string
}

function isExemptPath(pathname: string | null) {
  if (!pathname) return true
  return (
    pathname === "/login" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/auth/")
  )
}

function isDashboardPath(pathname: string | null) {
  return pathname === "/dashboard"
}

export function TermsAcceptanceGate({ currentTermsVersion }: TermsAcceptanceGateProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [supabase] = React.useState(() => createClient())
  const [userId, setUserId] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<TermsGateCachedStatus | null>(null)
  const [checked, setChecked] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const resolvedCacheKeyRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    let isMounted = true

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!isMounted) return
      setUserId(user?.id ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null
      setUserId(nextUserId)
      if (!nextUserId) {
        clearTermsGateCache()
        resolvedCacheKeyRef.current = null
        setStatus(null)
        setChecked(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  React.useEffect(() => {
    if (!userId || !isDashboardPath(pathname) || isExemptPath(pathname)) {
      return
    }

    const cacheKey = `${userId}:${currentTermsVersion}`
    if (resolvedCacheKeyRef.current === cacheKey) {
      return
    }

    const cachedStatus = readTermsGateCache(userId, currentTermsVersion)
    if (cachedStatus) {
      resolvedCacheKeyRef.current = cacheKey
      setStatus(cachedStatus)
      setChecked(false)
      return
    }

    let cancelled = false

    void fetch("/api/legal/acceptance-status", {
      method: "GET",
      cache: "no-store",
    })
      .then(async (response) => {
        if (cancelled) return
        if (response.status === 401) {
          setStatus(null)
          resolvedCacheKeyRef.current = null
          return
        }
        if (!response.ok) {
          throw new Error("Failed to check legal status.")
        }
        const nextStatus = (await response.json()) as TermsGateCachedStatus
        resolvedCacheKeyRef.current = cacheKey
        writeTermsGateCache(userId, currentTermsVersion, nextStatus)
        setStatus(nextStatus)
        setChecked(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error("[terms-gate] status", error)
        setStatus(null)
        resolvedCacheKeyRef.current = null
      })

    return () => {
      cancelled = true
    }
  }, [currentTermsVersion, pathname, userId])

  const open =
    Boolean(status?.needsAcceptance) && isDashboardPath(pathname) && !isExemptPath(pathname)
  const canAccept = checked && !submitting

  const handleAccept = async () => {
    if (!canAccept || !userId) return

    setSubmitting(true)
    try {
      const response = await fetch("/api/legal/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to record terms acceptance.")
      }

      const nextStatus: TermsGateCachedStatus = status
        ? { ...status, needsAcceptance: false, reason: null, acceptedVersion: currentTermsVersion }
        : {
            needsAcceptance: false,
            reason: null,
            acceptedAt: new Date().toISOString(),
            acceptedVersion: currentTermsVersion,
            currentTerms: {
              title: "Terms of Use",
              version: currentTermsVersion,
              lastUpdated: null,
              content: "",
              contentPreview: "",
            },
          }

      resolvedCacheKeyRef.current = `${userId}:${currentTermsVersion}`
      writeTermsGateCache(userId, currentTermsVersion, nextStatus)
      setStatus(nextStatus)
      setChecked(false)
      toast.success("Terms accepted.")
    } catch (error) {
      console.error("[terms-gate] accept", error)
      toast.error(error instanceof Error ? error.message : "Failed to record acceptance.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    clearTermsGateCache()
    resolvedCacheKeyRef.current = null
    setStatus(null)
    setChecked(false)
    router.push("/")
    router.refresh()
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="w-[min(96vw,28rem)] gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="space-y-2 px-6 pt-6 text-left">
          <DialogTitle>
            {status?.reason === "outdated" ? "We updated our Terms" : "Accept the current Terms"}
          </DialogTitle>
          <DialogDescription className="leading-6">
            {status?.reason === "outdated"
              ? "Review the latest Terms of Use and Privacy Policy, then confirm to continue."
              : "Review our Terms of Use and Privacy Policy, then confirm to continue."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              {status?.currentTerms.title ?? "Terms of Use"} v{status?.currentTerms.version}
            </p>
            {status?.currentTerms.lastUpdated ? (
              <p className="mt-1 text-xs uppercase tracking-wide">
                Last updated {status.currentTerms.lastUpdated}
              </p>
            ) : null}
            <p className="mt-3 leading-6">
              Open the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="font-medium text-foreground underline underline-offset-2"
              >
                Terms of Use
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="font-medium text-foreground underline underline-offset-2"
              >
                Privacy Policy
              </Link>{" "}
              to review the full documents.
            </p>
          </div>

          <label htmlFor="terms-modal-accept" className="flex items-start gap-3 text-sm">
            <Checkbox
              id="terms-modal-accept"
              checked={checked}
              onCheckedChange={(value) => setChecked(value === true)}
              className="mt-0.5"
            />
            <span className="leading-6 text-muted-foreground">
              I have read and agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="font-medium text-foreground underline underline-offset-2"
              >
                Terms of Use
              </Link>{" "}
              and acknowledge the{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="font-medium text-foreground underline underline-offset-2"
              >
                Privacy Policy
              </Link>
              . I confirm that I am at least 18 years old.
            </span>
          </label>
        </div>

        <DialogFooter className="border-t border-border bg-background px-6 py-4 sm:justify-between">
          <Button type="button" variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
          <Button type="button" onClick={handleAccept} disabled={!canAccept}>
            {submitting ? "Saving..." : "Accept and continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
