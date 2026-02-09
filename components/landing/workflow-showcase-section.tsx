"use client"

import * as React from "react"
import Link from "next/link"
import { workflowItems } from "@/lib/constants/landing-content"

export function WorkflowShowcaseSection() {
  return (
    <section id="workflows" className="w-full bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Workflows
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">
            Orchestrate every creative step from one workspace
          </h2>
        </div>

        <div className="mt-12 space-y-6">
          {workflowItems.map((item) => {
            const bgSrc = item.backgroundSrc || item.mediaSrc
            const bgType = item.backgroundType || item.mediaType
            
            return (
              <Link
                key={item.title}
                href={item.href}
                className="group block"
              >
                <div className="relative overflow-hidden rounded-3xl bg-black">
                  {/* Background Layer */}
                  <div className="relative h-[500px] w-full sm:h-[600px]">
                    {bgType === "video" ? (
                      <video
                        src={bgSrc}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="h-full w-full object-cover opacity-40 blur-sm"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bgSrc}
                        alt=""
                        className="h-full w-full object-cover opacity-40 blur-sm"
                      />
                    )}
                  </div>

                  {/* Center Image Layer */}
                  <div className="absolute inset-0 flex items-center justify-center p-8">
                    {item.mediaType === "video" ? (
                      <video
                        src={item.mediaSrc}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="max-h-[70%] max-w-[85%] rounded-2xl object-contain shadow-2xl transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.mediaSrc}
                        alt={item.title}
                        className="max-h-[70%] max-w-[85%] rounded-2xl object-contain shadow-2xl transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                  </div>
                  
                  {/* Dark Gradient Overlay for text readability */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

                  {/* Content Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12">
                    <div className="max-w-2xl">
                      <h3 className="text-4xl font-semibold text-white sm:text-5xl">
                        {item.category}
                      </h3>
                      <p className="mt-4 text-xl font-medium text-white/90 sm:text-2xl">
                        {item.title}
                      </p>
                      <p className="mt-3 text-base text-white/70 sm:text-lg">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
