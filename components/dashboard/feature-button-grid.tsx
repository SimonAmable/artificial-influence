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
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Features</h2>
      </div>
      <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-6">
        {/* Create New Project Button */}
        <div className="lg:col-span-1">
          <Button
            onClick={handleCreateProject}
            disabled={isLoading}
            className="h-full min-h-48 w-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg p-6 transition-all hover:shadow-lg disabled:opacity-50"
          >
            <div className="w-16 h-16 flex items-center justify-center bg-white/20 rounded-full">
              <PencilSimpleIcon size={32} weight="duotone" className="text-white" />
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">Create New</div>
              <div className="text-sm font-medium opacity-90">Project</div>
            </div>
          </Button>
        </div>

        {/* Tool Buttons */}
        <div className="lg:col-span-5">
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
      </div>
    </div>
  )
}
