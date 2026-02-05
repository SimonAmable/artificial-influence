"use client"

import * as React from "react"
import {
  TextT,
  Image as ImageIcon,
  VideoCamera,
  SpeakerHigh,
  UploadSimple,
  type IconProps,
} from "@phosphor-icons/react"
import { motion } from "framer-motion"
import type { CanvasNodeType, CanvasNodeData } from "@/lib/canvas/types"

type IconComponent = React.ComponentType<IconProps>

interface AddNodesMenuProps {
  onAddNode: (type: CanvasNodeType, initialData?: Partial<CanvasNodeData>) => void
  onClose?: () => void
  className?: string
}

export function AddNodesMenu({ onAddNode, onClose, className }: AddNodesMenuProps) {
  const handleAdd = (type: CanvasNodeType) => {
    onAddNode(type)
    onClose?.()
  }

  return (
    <div className={className}>
      <div className="px-2 py-1.5 mb-2">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Add Nodes</span>
      </div>

      <div className="flex flex-col gap-1">
        <AddNodeItem
          icon={TextT}
          title="Text"
          badge="Gemini 3"
          description="Script, Ad copy, Brand text"
          onClick={() => handleAdd("text")}
        />
        <AddNodeItem
          icon={ImageIcon}
          title="Image"
          badge="Banana Pro"
          onClick={() => handleAdd("image-gen")}
        />
        <AddNodeItem
          icon={VideoCamera}
          title="Video"
          onClick={() => handleAdd("video-gen")}
        />
        <AddNodeItem
          icon={SpeakerHigh}
          title="Audio"
          badge="Beta"
          onClick={() => handleAdd("audio")}
        />

        <div className="h-px bg-white/5 my-2" />
        <div className="px-2 py-1.5 mb-1">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Add Source</span>
        </div>

        <AddNodeItem
          icon={UploadSimple}
          title="Upload"
          onClick={() => handleAdd("upload")}
        />
      </div>
    </div>
  )
}

function AddNodeItem({
  icon: Icon,
  title,
  badge,
  description,
  onClick,
}: {
  icon: IconComponent
  title: string
  badge?: string
  description?: string
  onClick: () => void
}) {
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-start gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors text-left group w-full"
    >
      <div className="w-10 h-10 shrink-0 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-zinc-700 transition-colors">
        <Icon size={20} weight="bold" />
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{title}</span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-400 font-bold border border-white/5">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{
              opacity: isHovered ? 1 : 0,
              y: isHovered ? 0 : -4,
            }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="text-xs text-zinc-500 leading-tight overflow-hidden"
            style={{ height: isHovered ? "auto" : 0 }}
          >
            {description}
          </motion.span>
        )}
      </div>
    </button>
  )
}
