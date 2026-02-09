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
} from "@phosphor-icons/react"

const toolButtons = [
  { label: "Image Studio", href: "/image", icon: ImageIcon, description: "Generate AI images from text" },
  { label: "Video Studio", href: "/video", icon: VideoIcon, description: "Create videos with AI effects" },
  { label: "Motion Copy", href: "/motion-copy", icon: PencilSimpleIcon, description: "Copy motion from reference videos" },
  { label: "Lip Sync", href: "/lipsync", icon: MicrophoneIcon, description: "Sync speech to video footage" },
  { label: "Image Editing", href: "/influencer-generator", icon: PaintBrushIcon, description: "Edit and enhance images with AI" },
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
    <div className="w-full space-y-6">
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

      {/* Tool cards - stacked layout per tool */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {toolButtons.map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex flex-col items-center text-center p-5 rounded-xl transition-all duration-200 hover:shadow-md"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center text-primary">
                <Icon size={24} weight="duotone" className="shrink-0" />
              </div>
              <h3 className="font-semibold text-sm mb-1">{tool.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {tool.description}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
