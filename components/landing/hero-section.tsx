"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { TypingAnimation } from "@/components/ui/typing-animation"
import LightRays from "@/components/LightRays"
import { BlurFade } from "@/components/ui/blur-fade"
import { motion, AnimatePresence } from "motion/react"
import { Iphone } from "@/components/ui/iphone"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { X } from "lucide-react"

const VIDEO_FILES = [
  "/hero_showcase_images/lipsync_final.mp4",
  // "/hero_showcase_images/motion_copy_dance_1.mp4",
  // "/hero_showcase_images/motion_copy_dance_2.mp4",
  "/hero_showcase_images/motion_copy.mp4",
]

export function HeroSection() {
  const [typingComplete, setTypingComplete] = React.useState(false)
  const [showDither, setShowDither] = React.useState(false)
  const [showLights, setShowLights] = React.useState(false)
  const [mobileVideoIndex, setMobileVideoIndex] = React.useState(0)
  const [isMediaViewerOpen, setIsMediaViewerOpen] = React.useState(false)
  const [currentVideoIndex, setCurrentVideoIndex] = React.useState(0)
  const videoRefs = React.useRef<(HTMLVideoElement | null)[]>([])
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const hasTriggeredThemeChange = React.useRef(false)

  // Calculate typing duration based on text length
  const text = "Artificial Influence"
  const typingDuration = 15 // ms per character (reduced from 50)
  const pauseDelay = 150 // pause after typing completes (reduced from 1000)
  const totalTypingTime = text.length * typingDuration + pauseDelay
  
  // Animation timing sequence - all animations complete within 2 seconds:
  // 1. Typing: 0ms to totalTypingTime (450ms)
  // 2. Subtitle: starts at totalTypingTime (450ms), duration 300ms, ends at 750ms
  // 3. Buttons: starts at 750ms, duration 300ms, ends at 1050ms
  // 4. Header and media: starts at 600ms (overlaps with subtitle)
  // 5. Lights: starts at 1000ms, duration 400ms, ends at 1400ms
  const subtitleDelay = totalTypingTime // 450ms
  const subtitleDuration = 300 // ms (reduced from 1500)
  const buttonsDelay = subtitleDelay + subtitleDuration // 750ms
  const buttonsDuration = 300 // ms (reduced from 1500)
  const headerMediaDelay = 600 // ms (reduced from 3000)
  const lightsDelay = 1000 // ms (reduced from 5000)

  React.useEffect(() => {
    // Mark typing as complete after animation finishes
    const timer = setTimeout(() => {
      setTypingComplete(true)
    }, totalTypingTime)

    return () => clearTimeout(timer)
  }, [totalTypingTime])

  React.useEffect(() => {
    // Show media (dither) when header should appear
    const ditherTimer = setTimeout(() => {
      setShowDither(true)
    }, headerMediaDelay)

    return () => clearTimeout(ditherTimer)
  }, [headerMediaDelay])

  React.useEffect(() => {
    // Show lights 2 seconds after header/media
    const lightsTimer = setTimeout(() => {
      setShowLights(true)
    }, lightsDelay)

    return () => clearTimeout(lightsTimer)
  }, [lightsDelay])

  React.useEffect(() => {
    // Switch to dark mode when showing dither
    if (!showDither || hasTriggeredThemeChange.current) return

    hasTriggeredThemeChange.current = true
    document.documentElement.classList.add("dark")
    localStorage.setItem("theme", "dark")
  }, [showDither])

  // Handle video rotation on mobile when video ends
  const handleVideoEnded = React.useCallback(() => {
    setMobileVideoIndex((prev) => (prev + 1) % VIDEO_FILES.length)
  }, [])

  // Handle smooth scroll to features section
  const handleLearnMore = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const featuresSection = document.getElementById("features")
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  // Handle opening media viewer
  const handleMediaClick = React.useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    setCurrentVideoIndex(index)
    setIsMediaViewerOpen(true)
  }, [])

  // Scroll to clicked video when modal opens
  React.useEffect(() => {
    if (isMediaViewerOpen && scrollContainerRef.current && videoRefs.current[currentVideoIndex]) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        videoRefs.current[currentVideoIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      }, 100)
    }
  }, [isMediaViewerOpen, currentVideoIndex])

  // Autoplay video in viewport using Intersection Observer
  React.useEffect(() => {
    if (!isMediaViewerOpen) return

    const observerOptions = {
      root: scrollContainerRef.current,
      rootMargin: "0px",
      threshold: 0.5, // Video is considered "in view" when 50% visible
    }

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement
        if (entry.isIntersecting) {
          // Play the video in view
          video.play().catch(() => {
            // Autoplay may be blocked by browser, ignore error
          })
        } else {
          // Pause videos not in view
          video.pause()
        }
      })
    }

    const observer = new IntersectionObserver(handleIntersection, observerOptions)

    // Observe all videos
    videoRefs.current.forEach((video) => {
      if (video) {
        observer.observe(video)
      }
    })

    return () => {
      observer.disconnect()
      // Pause all videos when modal closes
      videoRefs.current.forEach((video) => {
        if (video) {
          video.pause()
        }
      })
    }
  }, [isMediaViewerOpen])

  // Handle keyboard navigation in media viewer
  React.useEffect(() => {
    if (!isMediaViewerOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setIsMediaViewerOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isMediaViewerOpen])

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative min-h-screen w-full",
        "flex flex-col items-center",
        "bg-background",
        "overflow-x-hidden",
        "py-8 md:py-12",
        "md:justify-center"
      )}
    >
      {/* Light Rays Background - appears last */}
      {showLights && (
        <BlurFade
          inView={true}
          duration={0.4}
          delay={0}
          blur="20px"
          direction="down"
          offset={0}
          className="fixed inset-0 z-0 w-full h-full pointer-events-none touch-none"
        >
          <LightRays
            key="light-rays-effect" // Stable key to prevent remounting
            raysOrigin="top-center"
            raysColor="#ffffff"
            raysSpeed={1}
            lightSpread={1}
            rayLength={2}
            pulsating={false}
            fadeDistance={1.0}
            saturation={1.0}
            followMouse={true}
            mouseInfluence={0.1}
            noiseAmount={0.0}
            distortion={0.0}
            className="w-full h-full"
          />
        </BlurFade>
      )}

      {/* Main content wrapper */}
      <div className="relative z-20 w-full flex flex-col items-center touch-pan-y">
        {/* Main text content with typing animation */}
        <h1
          className={cn(
            "text-foreground",
            "text-5xl sm:text-6xl md:text-7xl lg:text-8xl",
            "font-bold",
            "text-center",
            "relative",
            "pt-4 md:pt-6"
          )}
        >
          <TypingAnimation
            // eslint-disable-next-line react/no-children-prop
            children={text}
            typeSpeed={typingDuration}
            pauseDelay={pauseDelay}
            startOnView={false}
            showCursor={true}
            blinkCursor={true}
            cursorStyle="line"
            loop={false}
            className="uppercase"
          />
        </h1>

        {/* Subtitle text - fades in after typing completes */}
        <BlurFade
          inView={true}
          duration={subtitleDuration / 1000}
          delay={subtitleDelay / 1000}
          blur="10px"
          direction="up"
          offset={20}
          className="mt-4 md:mt-6"
        >
          <p className="text-muted-foreground text-xl md:text-2xl lg:text-3xl text-center px-4 max-w-3xl mx-auto leading-relaxed">
            Create AI-powered influencers for UGC content, brand sponsorships, and ad testing. Transform your marketing with realistic virtual personalities.
          </p>
        </BlurFade>

        {/* CTA Buttons - fades in after subtitle completes */}
        <BlurFade
          inView={true}
          duration={buttonsDuration / 1000}
          delay={buttonsDelay / 1000}
          blur="10px"
          direction="up"
          offset={20}
          className="mt-6 md:mt-8 pointer-events-auto"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
            <Link href="/signup">
              <Button
                variant="secondary"
                size="lg"
                className="text-base md:text-lg px-8 md:px-10 py-6 md:py-7 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 w-full sm:w-auto"
              >
                Get Started Free
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              onClick={handleLearnMore}
              className="text-base md:text-lg px-8 md:px-10 py-6 md:py-7 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 w-full sm:w-auto"
            >
              Learn More
            </Button>
          </div>
        </BlurFade>

        {/* Video showcase - appears with staggered fade-in when dither appears */}
        {showDither && (
          <div
            className={cn(
              "relative w-full",
              "flex flex-col items-center",
              "mt-8 md:mt-12",
              "px-4",
              "pointer-events-auto"
            )}
          >
          {/* Desktop: Show all videos with staggered fade-in (appears with header and lights) */}
          <div className="hidden md:flex items-center justify-center gap-4 w-full max-w-6xl">
            {VIDEO_FILES.map((videoSrc, index) => (
              <BlurFade
                key={`desktop-${videoSrc}-${index}`}
                inView={true}
                duration={0.3}
                delay={index * 0.08} // Stagger delay: 0s, 0.08s, 0.16s, 0.24s (relative to showDither)
                blur="10px"
                direction="up"
                offset={20}
                className="relative flex-1 max-w-[200px] pointer-events-auto"
              >
                <div
                  onClick={(e) => handleMediaClick(e, index)}
                  className="cursor-pointer hover:scale-105 transition-transform duration-300 pointer-events-auto"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      // Create a synthetic mouse event for keyboard navigation
                      const syntheticEvent = {
                        ...e,
                        stopPropagation: () => e.stopPropagation(),
                      } as unknown as React.MouseEvent<HTMLDivElement>
                      handleMediaClick(syntheticEvent, index)
                    }
                  }}
                  aria-label="Open media viewer"
                >
                  <Iphone videoSrc={videoSrc} />
                </div>
              </BlurFade>
            ))}
          </div>

          {/* Mobile: Show one video at a time with fade transitions */}
          <div className="md:hidden relative w-full max-w-[200px] pointer-events-auto">
            <AnimatePresence mode="wait">
              {VIDEO_FILES.map((videoSrc, index) => {
                if (index !== mobileVideoIndex) return null
                return (
                  <motion.div
                    key={`mobile-${videoSrc}-${index}`}
                    initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="w-full pointer-events-auto"
                  >
                    <div
                      onClick={(e) => handleMediaClick(e, mobileVideoIndex)}
                      className="cursor-pointer active:scale-95 transition-transform duration-300 pointer-events-auto"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          // Create a synthetic mouse event for keyboard navigation
                          const syntheticEvent = {
                            ...e,
                            stopPropagation: () => e.stopPropagation(),
                          } as unknown as React.MouseEvent<HTMLDivElement>
                          handleMediaClick(syntheticEvent, mobileVideoIndex)
                        }
                      }}
                      aria-label="Open media viewer"
                    >
                      <Iphone 
                        videoSrc={videoSrc} 
                        loop={false}
                        onEnded={handleVideoEnded}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
        )}
      </div>

      {/* Full-screen Media Viewer Modal */}
      <AnimatePresence>
        {isMediaViewerOpen && (
          <>
            {/* Overlay background - clickable to close, behind content */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsMediaViewerOpen(false)}
            />
            
            {/* Content container - above overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[51]"
            >
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMediaViewerOpen(false)}
                className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full h-10 w-10 md:h-12 md:w-12 pointer-events-auto"
                aria-label="Close media viewer"
              >
                <X className="h-5 w-5 md:h-6 md:w-6" />
              </Button>

              {/* Scrollable video container */}
              <div
                ref={scrollContainerRef}
                className="w-full h-full overflow-y-auto overflow-x-hidden"
              >
                <div
                  className="min-h-full flex flex-col items-center justify-center py-4 md:py-8 px-4 pointer-events-auto"
                  onClick={(e) => {
                    // Close if clicking on empty space (the container div, not videos)
                    const target = e.target as HTMLElement
                    if (target === e.currentTarget) {
                      setIsMediaViewerOpen(false)
                    }
                  }}
                >
                  {VIDEO_FILES.map((videoSrc, index) => (
                    <motion.div
                      key={`viewer-${videoSrc}-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="w-full flex items-center justify-center mb-4 md:mb-8 last:mb-0"
                      style={{ minHeight: "100vh" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <video
                        ref={(el) => {
                          videoRefs.current[index] = el
                        }}
                        src={videoSrc}
                        controls
                        className="h-screen w-auto max-w-full object-contain"
                        preload="metadata"
                        playsInline
                        muted
                        onClick={(e) => e.stopPropagation()}
                      >
                        Your browser does not support the video tag.
                      </video>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
