"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight } from "@phosphor-icons/react"

import { ExtensionPanelShell } from "@/components/extension/extension-panel-shell"
import { Button } from "@/components/ui/button"

type ExtensionAuthPanelProps = {
  className?: string
}

export function ExtensionAuthPanel({ className }: ExtensionAuthPanelProps) {
  return (
    <ExtensionPanelShell className={className}>
      <div className="flex flex-col gap-4 px-4 pb-4 pt-2">
        <div className="rounded-2xl bg-muted/50 px-4 py-5 text-center ring-1 ring-inset ring-border/50">
          <p className="font-display text-sm font-bold uppercase tracking-tight text-foreground">
            Sign in to continue
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Connect your UniCan account to capture scenes, pick characters, and generate.
          </p>
          <Button asChild className="mt-4 h-10 w-full rounded-4xl font-bold uppercase tracking-wide">
            <Link href="/login?next=/extension/connect">
              Sign in
              <ArrowRight className="size-4" weight="bold" />
            </Link>
          </Button>
          <p className="mt-3 text-[11px] text-muted-foreground">
            No account?{" "}
            <Link href="/login?mode=signup&next=/extension/connect" className="font-medium text-foreground underline-offset-2 hover:underline">
              Create one
            </Link>
          </p>
        </div>

        <div className="pointer-events-none select-none opacity-45" aria-hidden>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-h-[120px] flex-col justify-end rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 p-2">
              <div className="h-9 rounded-2xl bg-background/70 ring-1 ring-inset ring-border/40" />
              <div className="mt-2 h-8 rounded-2xl bg-background/50 ring-1 ring-inset ring-border/30" />
            </div>
            <div className="min-h-[120px] rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40" />
          </div>
          <div className="mt-3 h-11 rounded-4xl bg-foreground/10" />
        </div>
      </div>
    </ExtensionPanelShell>
  )
}
