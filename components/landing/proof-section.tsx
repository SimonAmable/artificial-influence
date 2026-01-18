"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Iphone } from "@/components/ui/iphone"

const PROOF_IMAGES = [
  "/insta_proof/Screenshot_20260118_111335_Instagram.jpg",
  "/insta_proof/Screenshot_20260118_112044_Instagram.jpg",
  "/insta_proof/Screenshot_20260118_112211_Instagram.jpg",
]

export function ProofSection() {
  return (
    <section
      id="proof"
      className={cn(
        "relative min-h-screen w-full",
        "flex items-center justify-center",
        "bg-background",
        "py-8 md:py-12"
      )}
    >
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            PROOF
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            See examples of real AI influencers who have had success in the market.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-center justify-items-center">
          {PROOF_IMAGES.map((imageSrc, index) => (
            <div
              key={index}
              className="w-full max-w-[300px] md:max-w-[350px]"
            >
              <Iphone src={imageSrc} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
