"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  ImageIcon,
  VideoIcon,
  MicrophoneIcon,
  PaintBrushIcon,
  PencilSimpleIcon,
  ArrowsLeftRight,
  FlowArrow,
} from "@phosphor-icons/react"

const toolButtons = [
  { label: "Image Studio", href: "/image", icon: ImageIcon },
  { label: "Video Studio", href: "/video", icon: VideoIcon },
  { label: "Motion Copy", href: "/motion-copy", icon: PencilSimpleIcon },
  { label: "Lip Sync", href: "/lipsync", icon: MicrophoneIcon },
  { label: "Image Editing", href: "/influencer-generator", icon: PaintBrushIcon },
  { label: "Character Swap", href: "/character-swap", icon: ArrowsLeftRight },
  { label: "Workflow", href: "/canvases", icon: FlowArrow },
]

export function FeatureButtonGrid() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)

  const handleCreateProject = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/canvases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Canvas ${new Date().toLocaleDateString()}`,
          description: "New canvas project",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create canvas")
      }

      const canvas = await response.json()
      router.push(`/canvas/${canvas.id}`)
    } catch (error) {
      console.error("Error creating canvas:", error)
      alert("Failed to create canvas. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full space-y-6 rounded-[24px]">
      {/* Header: Title + Create New Project */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold">Tools</h2>
        <Button
          onClick={handleCreateProject}
          disabled={isLoading}
          size="lg"
          variant="ghost"
        >
          <PencilSimpleIcon size={18} weight="bold" className="mr-2" />
          Create New Project
        </Button>
      </div>

      {/* Tool buttons: icon left, label right; fill row width responsively */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
        {toolButtons.map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="flex min-w-0 items-center gap-3 rounded-[24px] px-4 py-3 transition-shadow duration-200 hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[24px] bg-muted text-foreground shadow-sm">
                <Icon size={22} weight="duotone" className="shrink-0" />
              </div>
              <span className="font-semibold text-sm text-foreground text-center flex-1 min-w-0">
                {tool.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
