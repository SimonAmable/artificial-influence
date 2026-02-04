"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  ImageIcon,
  VideoIcon,
  MicrophoneIcon,
  PaintBrushIcon,
   PencilSimpleIcon,
} from "@phosphor-icons/react"

const toolButtons = [
  { label: "Image Studio", href: "/image", icon: ImageIcon, description: "Generate AI images from text" },
  { label: "Video Studio", href: "/video", icon: VideoIcon, description: "Create videos with AI effects" },
  { label: "Motion Copy", href: "/motion-copy", icon: PencilSimpleIcon, description: "Copy motion from reference videos" },
  { label: "Lip Sync", href: "/lipsync", icon: MicrophoneIcon, description: "Sync speech to video footage" },
  { label: "Image Editing", href: "/influencer-generator", icon: PaintBrushIcon, description: "Edit and enhance images with AI" },
]

export function FeatureButtonGrid() {
  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Tools</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {toolButtons.map((tool) => (
          <Button
            key={tool.href}
            asChild
            variant="ghost"
            className="h-auto justify-start gap-4 p-3 transition-shadow hover:shadow-md"
          >
            <Link href={tool.href} className="flex items-center gap-4">
              <div className="w-14 h-14 flex items-center justify-center flex-shrink-0">
                <tool.icon size={48} weight="duotone" className="text-primary" style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px' }} />
              </div>
              <div className="flex flex-col items-start gap-1">
                <span className="text-lg font-bold text-left">{tool.label}</span>
                <span className="text-xs text-muted-foreground text-left">{tool.description}</span>
              </div>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  )
}
