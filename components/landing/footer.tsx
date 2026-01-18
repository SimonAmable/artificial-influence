"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import Ballpit from "@/components/Ballpit"
import Link from "next/link"

export function Footer() {
  return (
    <footer
      className={cn(
        "relative w-full",
        "bg-background",
        "overflow-hidden"
      )}
    >
      {/* Ballpit Background */}
      <div className="absolute inset-0 z-0">
        <Ballpit 
          className="w-full h-full opacity-30 dark:opacity-20"
          followCursor={true}
          count={30}
        />
      </div>

      {/* Gradient overlay for better text readability */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-background via-background/80 to-background/60" />

      {/* Footer Content */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-bold text-foreground mb-4">
              Artificial Influence
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
              Make AI influencers for UGC, getting sponsors, and testing ads. 
              Create stunning content with our powerful AI tools.
            </p>
          </div>

          {/* Links Section */}
          <div className="col-span-1">
            <h4 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
              Product
            </h4>
            <ul className="space-y-3">
              <li>
                <Link 
                  href="/image" 
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                >
                  Image Generation
                </Link>
              </li>
              <li>
                <Link 
                  href="/motion-copy" 
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                >
                  Motion Copy
                </Link>
              </li>
              <li>
                <Link 
                  href="/lipsync" 
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                >
                  Lip Sync
                </Link>
              </li>
              <li>
                <Link 
                  href="/influencer-generator" 
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                >
                  Influencer Generator
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} Artificial Influence. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
