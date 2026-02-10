"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CharacterSwapShowcaseCardProps {
  className?: string
}

export function CharacterSwapShowcaseCard({ className }: CharacterSwapShowcaseCardProps) {
  return (
    <div className={cn("h-[50vh] md:h-[60vh] pt-0 px-4 flex flex-col gap-2", className)}>
      {/* Main Title */}
      <div className="space-y-1 text-center">
        <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold leading-tight">
          Swap Character Into{" "}
          <span className="text-primary">Any Scene</span>
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
          Upload one character image and one scene image, then generate with NanoBanana Pro.
        </p>
      </div>

      {/* Image - Takes remaining space */}
      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        <div className="w-full h-full max-w-4xl">
          <img
            src="/hero_showcase_images/image_editing.png"
            alt="CHARACTER SWAP PREVIEW"
            className="w-full h-full object-contain rounded-lg"
          />
        </div>
      </div>

      {/* Optional description below image */}
      <div className="text-center pb-2">
        <h4 className="font-semibold text-sm uppercase tracking-wide">
          CHARACTER SWAP PREVIEW
        </h4>
        <p className="text-sm text-muted-foreground">
          Simple example showcase image for the character swap tool.
        </p>
      </div>
    </div>
  )
}

