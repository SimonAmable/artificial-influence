import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, ShieldCheck } from "@phosphor-icons/react/dist/ssr"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Free AI Image Tools",
  description: "Free browser-based tools for cleaning and preparing AI image assets.",
}

const freeTools = [
  {
    href: "/free-tools/metadata-remover",
    label: "Metadata Remover",
    description: "Remove embedded metadata from static AI images in your browser.",
    badge: "Free",
  },
]

export default function FreeToolsPage() {
  return (
    <div className="min-h-screen bg-background px-4 pb-12 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="max-w-3xl">
          <Badge variant="secondary" className="mb-3 w-fit gap-1.5">
            <ShieldCheck className="size-3.5" weight="duotone" />
            Free tools
          </Badge>
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
            Free AI Image Tools
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Browser-based utilities for cleaning and preparing AI image assets without credits.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {freeTools.map((tool) => (
            <Card key={tool.href} className="overflow-hidden">
              <CardContent className="flex h-full min-h-[220px] flex-col p-5">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex size-12 items-center justify-center rounded-lg border bg-muted">
                    <ShieldCheck className="size-6" weight="duotone" />
                  </div>
                  <Badge>{tool.badge}</Badge>
                </div>
                <div className="min-h-0 flex-1">
                  <h2 className="text-xl font-bold">{tool.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {tool.description}
                  </p>
                </div>
                <Button asChild className="mt-6 w-full justify-between">
                  <Link href={tool.href}>
                    Open tool
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
