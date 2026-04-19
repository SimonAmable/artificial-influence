'use client'

import * as React from 'react'
import Link from 'next/link'
import { Copy, Check, Wallet, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { AffiliateAgreementMarkdown } from '@/components/affiliate/affiliate-agreement-markdown'

const SUPPORT_EMAIL = 'support@synthetichumanlabs.com'
const MIN_PAYOUT_USD = 50

type AffiliateRow = {
  id: string
  code: string
  agreed_to_terms_at: string
  agreed_terms_text?: string
  status: string
}

type ReferralRow = {
  id: string
  first_converted_at: string
  commission_eligible_until: string
}

type CommissionRow = {
  id: string
  created_at: string
  invoice_amount_cents: number
  commission_amount_cents: number
  commission_rate: number
  currency: string
  status: string
  stripe_invoice_id: string
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

export function AffiliateDashboard({
  appOrigin,
  affiliate,
  referrals,
  commissions,
}: {
  appOrigin: string
  affiliate: AffiliateRow
  referrals: ReferralRow[]
  commissions: CommissionRow[]
}) {
  const origin = appOrigin.replace(/\/$/, '')
  const link = `${origin}/?ref=${encodeURIComponent(affiliate.code)}`

  const [copied, setCopied] = React.useState(false)
  const [now] = React.useState(() => Date.now())

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const activeReferrals = referrals.filter(
    (r) => new Date(r.commission_eligible_until).getTime() > now
  )
  const totalCommissionCents = commissions.reduce(
    (s, c) => s + c.commission_amount_cents,
    0
  )

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background py-[60px] px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Affiliates
            </h1>
            <p className="text-muted-foreground">
              Share your link. Earn 20% on qualifying subscription revenue for
              up to 12 months per referred customer.
            </p>
          </div>
          <PayoutDialog
            accruedCents={totalCommissionCents}
            eligible={totalCommissionCents >= MIN_PAYOUT_USD * 100}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Your link
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm break-all">
              {link}
            </code>
            <Button
              type="button"
              variant="secondary"
              onClick={copyLink}
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="size-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Code <span className="font-mono font-medium">{affiliate.code}</span>{' '}
            is permanent. Add{' '}
            <span className="font-mono">?ref={affiliate.code}</span> to any page
            on this site.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Total converted referrals</p>
            <p className="text-2xl font-semibold mt-1">{referrals.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Active referrals</p>
            <p className="text-2xl font-semibold mt-1">{activeReferrals.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Within 12 months of first payment
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Commission accrued</p>
            <p className="text-2xl font-semibold mt-1">
              {formatMoney(totalCommissionCents, 'usd')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Pending payout</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="font-semibold">Commission history</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Invoice</th>
                  <th className="px-6 py-3 font-medium">Your 20%</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      No commissions yet. When referred users pay their
                      subscription, entries appear here.
                    </td>
                  </tr>
                ) : (
                  commissions.map((c) => (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="px-6 py-3 whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3">
                        {formatMoney(c.invoice_amount_cents, c.currency)}
                      </td>
                      <td className="px-6 py-3 font-medium">
                        {formatMoney(c.commission_amount_cents, c.currency)}
                      </td>
                      <td className="px-6 py-3 capitalize">{c.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {affiliate.agreed_terms_text ? (
          <details className="rounded-2xl border border-border bg-card px-5 py-4 text-sm group">
            <summary className="cursor-pointer font-medium list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>Agreement on file</span>
              <span className="text-xs text-muted-foreground font-normal shrink-0">
                Accepted{' '}
                {new Date(affiliate.agreed_to_terms_at).toLocaleString()}
              </span>
            </summary>
            <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-3">
              This is the exact text stored with your account for your records.
            </p>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-muted/50 p-3 text-xs">
              <AffiliateAgreementMarkdown source={affiliate.agreed_terms_text} />
            </div>
          </details>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Payouts and tax reporting are processed according to the Affiliate
          Program Agreement.{' '}
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>
        </p>
      </div>
    </div>
  )
}

function PayoutDialog({
  accruedCents,
  eligible,
}: {
  accruedCents: number
  eligible: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const subject = `Affiliate payout request`
  const body = `Hi,\n\nI'd like to request a payout for my affiliate commissions.\n\nAccrued balance: ${formatMoney(accruedCents, 'usd')}\n\nThanks.`
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 sm:self-start"
      >
        <Wallet className="size-4 mr-2" />
        Request payout
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a payout</DialogTitle>
          <DialogDescription>
            Payouts are processed manually. Reach out and we&apos;ll get you
            paid.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Minimum payout
            </p>
            <p className="text-xl font-semibold">${MIN_PAYOUT_USD}.00 USD</p>
            <p className="text-xs text-muted-foreground">
              Your accrued balance must be at least $
              {MIN_PAYOUT_USD.toFixed(2)} before a payout can be issued.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Your balance
            </p>
            <p className="text-base font-medium">
              {formatMoney(accruedCents, 'usd')}{' '}
              <span className="text-xs text-muted-foreground font-normal">
                {eligible
                  ? "Eligible for payout"
                  : `$${(
                      (MIN_PAYOUT_USD * 100 - accruedCents) /
                      100
                    ).toFixed(2)} to go`}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              How to request
            </p>
            <p className="text-muted-foreground">
              Email support with your preferred payout method (PayPal, bank
              transfer, etc.) and we&apos;ll process it within 5 business days.
            </p>
            <a
              href={mailto}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors break-all"
            >
              <Mail className="size-4 shrink-0" />
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        <DialogFooter>
          <DialogClose>Close</DialogClose>
          <Button type="button" asChild>
            <a href={mailto}>
              <Mail className="size-4 mr-2" />
              Email support
            </a>
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
