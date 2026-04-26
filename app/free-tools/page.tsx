import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  ImageSquare,
  ShieldCheck,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Free Creator Tools",
  description: "Free browser-based tools for cleaning, compressing, and preparing creator assets.",
}

const freeTools = [
  {
    href: "/free-tools/metadata-remover",
    label: "Metadata Remover",
    description: "Remove embedded metadata from static AI images in your browser.",
    badge: "Free",
    icon: ShieldCheck,
  },
  {
    href: "/free-tools/image-compressor",
    label: "Image Compressor",
    description: "Resize and compress images locally before uploading or publishing.",
    badge: "Free",
    icon: ImageSquare,
  },
  {
    href: "/free-tools/video-compressor",
    label: "Video Compressor",
    description: "Create smaller WebM versions of short clips without uploading them.",
    badge: "Free",
    icon: VideoCamera,
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
            Free Creator Tools
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Browser-based utilities for cleaning, compressing, and preparing assets without credits.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {freeTools.map((tool) => {
            const Icon = tool.icon

            return (
              <Card key={tool.href} className="overflow-hidden">
                <CardContent className="flex h-full min-h-[220px] flex-col p-5">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex size-12 items-center justify-center rounded-lg border bg-muted">
                      <Icon className="size-6" weight="duotone" />
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
            )
          })}
        </div>
      </div>
    </div>
  )
}
