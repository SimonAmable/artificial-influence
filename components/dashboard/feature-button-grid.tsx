"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { dashboardToolNavItems, type DashboardToolIcon } from "@/lib/constants/navigation"
import {
  ImageIcon,
  VideoIcon,
  MicrophoneIcon,
  PaintBrushIcon,
  PencilSimpleIcon,
  ArrowsLeftRight,
  FlowArrow,
  Palette,
  SquaresFour,
  ChatCircleDots,
  Robot,
  ShieldCheck,
  Users,
} from "@phosphor-icons/react"

const toolIconMap: Record<DashboardToolIcon, typeof ImageIcon> = {
  palette: Palette,
  "flow-arrow": FlowArrow,
  microphone: MicrophoneIcon,
  image: ImageIcon,
  video: VideoIcon,
  "paint-brush": PaintBrushIcon,
  "arrows-left-right": ArrowsLeftRight,
  users: Users,
  "pencil-simple": PencilSimpleIcon,
  "squares-four": SquaresFour,
  "chat-circle-dots": ChatCircleDots,
  robot: Robot,
  "shield-check": ShieldCheck,
}

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold">Tools</h2>
        <Button
          onClick={handleCreateProject}
          disabled={isLoading}
          size="lg"
          variant="ghost"
          className="shadow-md transition-shadow hover:shadow-lg"
        >
          <PencilSimpleIcon size={18} weight="bold" className="mr-2" />
          Create New Project
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
        {dashboardToolNavItems.map((tool) => {
          const Icon = toolIconMap[tool.icon]
          return (
            <Tooltip key={tool.href}>
              <TooltipTrigger asChild>
                <Link
                  href={tool.href}
                  title={tool.hint}
                  className="flex min-w-0 items-center gap-3 rounded-[24px] px-4 py-3 outline-none transition-shadow duration-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[24px] bg-muted text-foreground shadow-sm">
                    <Icon size={22} weight="duotone" className="shrink-0" />
                  </div>
                  <span className="min-w-0 flex-1 text-center text-sm font-semibold text-foreground">
                    {tool.label}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-left leading-snug">
                {tool.hint}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
