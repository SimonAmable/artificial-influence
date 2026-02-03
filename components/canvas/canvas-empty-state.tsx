"use client"

import {
  Sparkle,
  VideoCamera,
  Image as ImageIcon,
  FilmSlate,
  SpeakerHigh,
  FlowArrow,
} from "@phosphor-icons/react"

interface CanvasEmptyStateProps {
  onQuickAction: (action: string) => void
}

const quickActions = [
  { label: "Text to Video", icon: VideoCamera, action: "text-to-video" },
  { label: "Change Background", icon: ImageIcon, action: "change-background" },
  { label: "First-frame to Video", icon: FilmSlate, action: "first-frame-to-video" },
  { label: "Audio to Video", icon: SpeakerHigh, action: "audio-to-video" },
  { label: "Workflow", icon: FlowArrow, action: "workflow" },
]

export function CanvasEmptyState({ onQuickAction }: CanvasEmptyStateProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
      {/* Instruction text */}
      <div className="flex items-center gap-2 mb-6">
        <span className="inline-flex items-center gap-1.5 bg-zinc-800/80 border border-white/10 rounded-full px-3.5 py-1.5 text-sm text-zinc-300">
          <Sparkle size={16} weight="fill" className="text-primary" />
          Double click
        </span>
        <span className="text-zinc-500 text-sm">
          the canvas to generate freely, or view the workflow template.
        </span>
      </div>

      {/* Quick action chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
        {quickActions.map((action) => (
          <button
            key={action.action}
            onClick={() => onQuickAction(action.action)}
            data-testid={`quick-action-${action.action}`}
            className="inline-flex items-center gap-2 bg-zinc-800/60 border border-white/10 rounded-full px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700/60 hover:text-white hover:border-white/20 transition-all"
          >
            <action.icon size={16} />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
