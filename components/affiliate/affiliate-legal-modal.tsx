'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { AffiliateAgreementMarkdown } from '@/components/affiliate/affiliate-agreement-markdown'
import { validateAffiliateCodeFormat } from '@/lib/affiliate/utils'
import { cn } from '@/lib/utils'

export function AffiliateLegalModal({
  agreementText,
}: {
  agreementText: string
}) {
  const router = useRouter()
  const [code, setCode] = React.useState('')
  const [agreed, setAgreed] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [checkState, setCheckState] = React.useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle')

  React.useEffect(() => {
    const trimmed = code.trim()
    if (!trimmed) {
      setCheckState('idle')
      return
    }
    if (!validateAffiliateCodeFormat(trimmed)) {
      setCheckState('invalid')
      return
    }

    setCheckState('checking')
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/affiliate/check-code?code=${encodeURIComponent(trimmed)}`
        )
        const data = (await res.json()) as { available?: boolean }
        setCheckState(data.available ? 'available' : 'taken')
      } catch {
        setCheckState('idle')
      }
    }, 400)

    return () => window.clearTimeout(t)
  }, [code])

  const canSubmit =
    agreed &&
    checkState === 'available' &&
    validateAffiliateCodeFormat(code.trim()) &&
    !submitting

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/affiliate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Request failed')
        return
      }
      router.refresh()
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <Dialog open={true}>
        <DialogContent
          className="max-h-[min(90vh,720px)] max-w-lg sm:max-w-xl overflow-hidden flex flex-col gap-0 p-0"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0 text-left">
              <DialogTitle>Affiliate program</DialogTitle>
              <DialogDescription>
                Read the agreement, choose your permanent referral code, then
                accept to get your link.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 flex-1 min-h-0 overflow-y-auto border-y border-border py-4 space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4 max-h-[min(40vh,320px)] overflow-y-auto">
                <AffiliateAgreementMarkdown source={agreementText} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="affiliate-code">Your referral code</Label>
                <div className="relative">
                  <Input
                    id="affiliate-code"
                    name="code"
                    autoComplete="off"
                    placeholder="e.g. mybrand"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="pr-10 font-mono"
                    maxLength={20}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkState === 'checking' ? (
                      <span className="text-xs text-muted-foreground">
                        …
                      </span>
                    ) : checkState === 'available' ? (
                      <Check className="size-4 text-green-600 dark:text-green-400" />
                    ) : checkState === 'taken' || checkState === 'invalid' ? (
                      <X className="size-4 text-destructive" />
                    ) : null}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  4–20 characters, letters and numbers only. Lowercase when
                  saved.{' '}
                  <span className="underline underline-offset-2">
                    Cannot be changed later.
                  </span>
                </p>
                {checkState === 'invalid' ? (
                  <p className="text-xs text-destructive">
                    Use 4–20 alphanumeric characters only.
                  </p>
                ) : null}
                {checkState === 'taken' ? (
                  <p className="text-xs text-destructive">That code is taken.</p>
                ) : null}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-snug">
                  I have read and agree to the Affiliate Program Agreement above,
                  including the 20% commission and 12-month recurring window
                  described there.
                </span>
              </label>
            </div>

            {error ? (
              <p className="px-6 text-sm text-destructive shrink-0">{error}</p>
            ) : null}

            <DialogFooter className="px-6 py-4 shrink-0 flex-col sm:flex-row gap-2 sm:justify-between sm:items-center border-t border-border">
              <Button variant="ghost" type="button" asChild>
                <Link href="/">Cancel</Link>
              </Button>
              <Button type="submit" disabled={!canSubmit} className={cn(!canSubmit && 'opacity-60')}>
                {submitting ? 'Saving…' : 'Accept & get my link'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
