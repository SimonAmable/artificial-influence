"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { TypingAnimation } from "@/components/ui/typing-animation"
import Dither from "@/components/Dither"
import { BlurFade } from "@/components/ui/blur-fade"
import { motion, AnimatePresence } from "motion/react"
import { Iphone } from "@/components/ui/iphone"

const VIDEO_FILES = [
  "/hero_showcase_images/lipsync_final.mp4",
  "/hero_showcase_images/motion_copy_dance_1.mp4",
  "/hero_showcase_images/motion_copy_dance_2.mp4",
  "/hero_showcase_images/motion_copy.mp4",
]

export function HeroSection() {
  const [typingComplete, setTypingComplete] = React.useState(false)
  const [showDither, setShowDither] = React.useState(false)
  const [mobileVideoIndex, setMobileVideoIndex] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const hasTriggeredThemeChange = React.useRef(false)
  const mobileVideoIntervalRef = React.useRef<NodeJS.Timeout | null>(null)

  // Calculate typing duration based on text length
  const text = "Artificial Influence"
  const typingDuration = 50 // ms per character
  const pauseDelay = 1000 // pause after typing completes (matches TypingAnimation default)
  const totalTypingTime = text.length * typingDuration + pauseDelay
  const ditherDelay = 1000 // 1 second delay after typing completes

  React.useEffect(() => {
    // Mark typing as complete after animation finishes
    const timer = setTimeout(() => {
      setTypingComplete(true)
    }, totalTypingTime)

    return () => clearTimeout(timer)
  }, [totalTypingTime])

  React.useEffect(() => {
    // Show Dither with blur fade after 1 second delay
    if (!typingComplete) return

    const ditherTimer = setTimeout(() => {
      setShowDither(true)
    }, ditherDelay)

    return () => clearTimeout(ditherTimer)
  }, [typingComplete, ditherDelay])

  React.useEffect(() => {
    // Switch to dark mode when showing dither
    if (!showDither || hasTriggeredThemeChange.current) return

    hasTriggeredThemeChange.current = true
    document.documentElement.classList.add("dark")
    localStorage.setItem("theme", "dark")
  }, [showDither])

  // Mobile video carousel - switch videos every 3 seconds
  React.useEffect(() => {
    if (!showDither) return

    const handleResize = () => {
      const isMobile = window.innerWidth < 768 // md breakpoint
      
      if (isMobile) {
        // Start carousel on mobile
        if (mobileVideoIntervalRef.current) {
          clearInterval(mobileVideoIntervalRef.current)
        }
        mobileVideoIntervalRef.current = setInterval(() => {
          setMobileVideoIndex((prev) => (prev + 1) % VIDEO_FILES.length)
        }, 3000)
      } else {
        // Clear interval on desktop
        if (mobileVideoIntervalRef.current) {
          clearInterval(mobileVideoIntervalRef.current)
          mobileVideoIntervalRef.current = null
        }
      }
    }

    // Check on mount and when showDither changes
    handleResize()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      if (mobileVideoIntervalRef.current) {
        clearInterval(mobileVideoIntervalRef.current)
      }
    }
  }, [showDither])

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative min-h-screen w-full",
        "flex flex-col items-center justify-center",
        "bg-background",
        "overflow-x-hidden",
        "py-8 md:py-12"
      )}
    >
      {/* Dither Background - appears with blur fade after typing completes */}
      {showDither && (
        <BlurFade
          inView={true}
          duration={1.5}
          delay={0}
          blur="20px"
          direction="down"
          offset={0}
          className="fixed inset-0 z-0 w-full h-full"
        >
          <Dither
            waveSpeed={0.05}
            waveFrequency={3}
            waveAmplitude={0.3}
            waveColor={[0.5, 0.5, 0.5]}
            colorNum={4}
            pixelSize={2}
            disableAnimation={false}
            enableMouseInteraction={true}
            mouseRadius={1}
          />
        </BlurFade>
      )}

      {/* Main content wrapper */}
      <div className="relative z-20 w-full flex flex-col items-center pointer-events-none">
        {/* Main text content with typing animation */}
        <h1
          className={cn(
            "text-foreground",
            "text-5xl sm:text-6xl md:text-7xl lg:text-8xl",
            "font-bold",
            "text-center",
            "relative",
            "pointer-events-none"
          )}
        >
          <TypingAnimation
            // eslint-disable-next-line react/no-children-prop
            children={text}
            typeSpeed={typingDuration}
            startOnView={false}
            showCursor={true}
            blinkCursor={true}
            cursorStyle="line"
            loop={false}
            className="uppercase pointer-events-none"
          />
        </h1>

        {/* Subtitle text - fades in after 4 seconds */}
        <BlurFade
          inView={true}
          duration={1.5}
          delay={4}
          blur="10px"
          direction="up"
          offset={20}
          className="mt-4 md:mt-6 pointer-events-none"
        >
          <p className="text-primary text-xl md:text-2xl lg:text-3xl text-center px-4 pointer-events-none">
            Make AI influencers for UGC, getting sponsors, and testing adds
          </p>
        </BlurFade>

        {/* Video showcase - appears with staggered fade-in when dither appears */}
        {showDither && (
          <div
            className={cn(
              "relative w-full",
              "flex flex-col items-center",
              "mt-8 md:mt-12",
              "px-4"
            )}
          >
          {/* Desktop: Show all videos with staggered fade-in */}
          <div className="hidden md:flex items-center justify-center gap-4 w-full max-w-6xl">
            {VIDEO_FILES.map((videoSrc, index) => (
              <BlurFade
                key={`desktop-${videoSrc}-${index}`}
                inView={true}
                duration={1.5}
                delay={index * 0.3} // Stagger delay: 0s, 0.3s, 0.6s, 0.9s
                blur="10px"
                direction="up"
                offset={20}
                className="relative flex-1 max-w-[200px]"
              >
                <Iphone videoSrc={videoSrc} />
              </BlurFade>
            ))}
          </div>

          {/* Mobile: Show one video at a time with fade transitions */}
          <div className="md:hidden relative w-full max-w-[200px]">
            <AnimatePresence mode="wait">
              {VIDEO_FILES.map((videoSrc, index) => {
                if (index !== mobileVideoIndex) return null
                return (
                  <motion.div
                    key={`mobile-${videoSrc}-${index}`}
                    initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="w-full"
                  >
                    <Iphone videoSrc={videoSrc} />
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
