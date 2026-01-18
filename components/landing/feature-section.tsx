"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid"
import { 
  Image as ImageIcon, 
  Video, 
  Microphone, 
  PaintBrush 
} from "@phosphor-icons/react"
import Image from "next/image"

export function FeatureSection() {
  return (
    <section
      id="features"
      className={cn(
        "relative min-h-screen w-full",
        "flex items-center justify-center",
        "bg-background",
        "py-8 md:py-12"
      )}
    >
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-bold text-center text-foreground mb-12">
          Features
        </h2>
        <BentoGrid>
          <BentoCard
            name="Image Generation"
            className="col-span-1 md:col-span-2"
            description="Create stunning, high-quality images from text descriptions."
            href="/image"
            cta="Try Image Generation"
            Icon={ImageIcon}
            background={
              <div className="absolute inset-0">
                <Image
                  src="/hero_showcase_images/image_generation_wide.png"
                  alt="Image Generation"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/40 to-transparent" />
              </div>
            }
          />
          <BentoCard
            name="Motion Copy"
            className="col-span-1 md:row-span-2"
            description="Bring static images to life with realistic motion."
            href="/motion-copy"
            cta="Try Motion Copy"
            Icon={Video}
            background={
              <div className="absolute inset-0">
                <video
                  src="/hero_showcase_images/motion_copy.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/40 to-transparent" />
              </div>
            }
          />
          <BentoCard
            name="Lip Sync"
            className="col-span-1 md:row-span-2"
            description="Sync any audio to any face with precision."
            href="/lipsync"
            cta="Try Lip Sync"
            Icon={Microphone}
            background={
              <div className="absolute inset-0">
                <video
                  src="/hero_showcase_images/lipsync_final.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/40 to-transparent" />
              </div>
            }
          />
          <BentoCard
            name="Image Editing"
            className="col-span-1 md:col-span-2"
            description="Enhance, retouch, and transform your images with AI-powered editing tools."
            href="/image"
            cta="Try Image Editing"
            Icon={PaintBrush}
            background={
              <div className="absolute inset-0">
                <Image
                  src="/hero_showcase_images/image_editing_wide.png"
                  alt="Image Editing"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/40 to-transparent" />
              </div>
            }
          />
        </BentoGrid>
      </div>
    </section>
  )
}
