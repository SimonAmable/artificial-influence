import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr"

import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = {
  title: "Free Creator Tools",
  description: "Free browser-based tools for cleaning, compressing, and preparing creator assets.",
}

const freeTools = [
  {
    href: "/free-tools/metadata-remover",
    label: "Metadata Remover",
    description: "Clean hidden metadata from AI images in your browser.",
    tags: ["Free", "Local"],
  },
  {
    href: "/free-tools/image-compressor",
    label: "Image Compressor",
    description: "Resize and compress images before posting or uploading.",
    tags: ["Free", "Local"],
  },
  {
    href: "/free-tools/tiktok-reference-downloader",
    label: "TikTok & Instagram Downloader",
    description: "Save public social references into stable hosted files.",
    tags: ["New", "Signed-in"],
  },
  {
    href: "/free-tools/tiktok-trend-search",
    label: "TikTok Trend Search",
    description: "Find inspiration clips with sorting and date filters.",
    tags: ["New", "Signed-in"],
  },
  {
    href: "/free-tools/tiktok-video-fixer",
    label: "TikTok Video Fixer",
    description: "Re-encode rejected clips into a safer MP4 profile.",
    tags: ["Free", "Signed-in"],
  },
  {
    href: "/free-tools/video-compressor",
    label: "Video Compressor",
    description: "Create smaller WebM versions of short clips locally.",
    tags: ["Free", "Local"],
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {freeTools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group relative flex min-h-[178px] overflow-hidden rounded-lg border bg-card/60 p-5 transition-colors hover:border-foreground/25 hover:bg-card"
            >
              <span className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full border bg-background/80 text-muted-foreground transition-colors group-hover:text-foreground">
                <ArrowRight className="size-4" />
              </span>
              <span className="absolute -right-5 -top-6 size-28 opacity-35 transition-opacity group-hover:opacity-55">
                <Image
                  src="/3d_icons/chrome_wrench.png"
                  alt=""
                  fill
                  sizes="112px"
                  className="object-contain"
                />
              </span>
              <span className="relative flex h-full min-w-0 flex-col justify-between gap-6 pr-10">
                <span>
                  <span className="mb-4 flex size-12 items-center justify-center rounded-lg border bg-background/70">
                    <Image
                      src="/3d_icons/chrome_wrench.png"
                      alt=""
                      width={42}
                      height={42}
                      className="object-contain"
                    />
                  </span>
                  <span className="block text-lg font-semibold tracking-tight text-foreground">
                    {tool.label}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    {tool.description}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  {tool.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="rounded-full px-2 py-0 text-[11px]">
                      {tag}
                    </Badge>
                  ))}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
