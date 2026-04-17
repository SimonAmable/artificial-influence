"use client"

import Image from "next/image"
import { useRef } from "react"
import { motion, useInView, useReducedMotion } from "motion/react"

const PROOF_IMAGES = [
  "/insta_proof/insta_proof_showcase_iphone/Screenshot-iPhone15 Pro Max-1-ss1.png",
  "/insta_proof/insta_proof_showcase_iphone/Screenshot-iPhone15 Pro Maxss-ss3.png",
] as const

const easeOut = [0.22, 1, 0.36, 1] as const

/** Pause after scroll trigger so the entrance doesn’t feel instant. */
const baseDelay = 0.22

/** Left image → right image → middle card; slightly longer beats between each. */
const staggerStep = 0.24

export function ProofSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: "0px 0px -12% 0px" })
  const reduceMotion = useReducedMotion()
  const revealed = isInView || reduceMotion

  return (
    <section
      ref={sectionRef}
      id="proof"
      className="relative w-full overflow-x-hidden bg-background py-0"
    >
      <div className="relative aspect-9/18 w-full overflow-x-hidden [--proof-img-w:min(122vw,760px)] md:aspect-9/10 md:[--proof-img-w:min(72vw,480px)] lg:aspect-9/9">
        {PROOF_IMAGES.map((imageSrc, index) => {
          const innerAnchor =
            index === 0
              ? "left-0 w-[var(--proof-img-w)] max-w-none -translate-x-1/2"
              : "left-full w-[var(--proof-img-w)] max-w-none -translate-x-1/2"
          const fromX = index === 0 ? -56 : 56
          return (
            <div
              key={imageSrc}
              className={
                index === 1
                  ? "absolute inset-x-0 top-1/2 z-10 w-full -translate-y-1/2 overflow-x-hidden"
                  : "absolute inset-x-0 top-1/2 z-0 w-full -translate-y-1/2 overflow-x-hidden"
              }
            >
              <div className={`relative ${innerAnchor}`}>
                <motion.div
                  className="w-full"
                  initial={reduceMotion ? { x: 0, opacity: 1 } : { x: fromX, opacity: 0 }}
                  animate={revealed ? { x: 0, opacity: 1 } : { x: fromX, opacity: 0 }}
                  transition={{
                    duration: 0.85,
                    ease: easeOut,
                    delay: baseDelay + index * staggerStep,
                  }}
                >
                  <Image
                    src={encodeURI(imageSrc)}
                    alt={`Instagram profile proof ${index + 1}`}
                    width={900}
                    height={1800}
                    className="h-auto w-full object-contain object-center drop-shadow-[0_24px_48px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_24px_48px_rgba(0,0,0,0.35)]"
                    sizes="(min-width: 768px) 480px, 100vw"
                    priority={index === 0}
                  />
                </motion.div>
              </div>
            </div>
          )
        })}

        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4">
          <motion.div
            className="pointer-events-auto mx-auto w-full max-w-2xl rounded-2xl bg-background/70 p-6 text-center shadow-xl ring-1 ring-border/40 backdrop-blur-md"
            initial={reduceMotion ? { scale: 1, opacity: 1 } : { scale: 0.94, opacity: 0 }}
            animate={revealed ? { scale: 1, opacity: 1 } : { scale: 0.94, opacity: 0 }}
            transition={{
              duration: 0.65,
              ease: easeOut,
              delay: baseDelay + PROOF_IMAGES.length * staggerStep,
            }}
          >
            <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
              Every week you wait, they&apos;re posting faster
            </h2>
            <p className="mt-4 text-muted-foreground">
              Creators use this to save time and strip friction, so posting stays easy and daily consistency actually
              sticks. The gap widens while you&apos;re still &quot;getting ready.&quot; Real feeds below, not mockups.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
