"use client"

import Image from "next/image"
import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { X } from "@phosphor-icons/react"

import { FAN_SIDE_ICONS, PlatformFanAvatar } from "@/components/mcp/mcp-platform-icons"
import type { McpConnectPlatform } from "@/lib/constants/mcp-connect"
import { cn } from "@/lib/utils"

gsap.registerPlugin(useGSAP)

type McpIconFanProps = {
  productName: string
  logoSrc: string
  activePlatform: McpConnectPlatform
  onPlatformSelect: (platform: McpConnectPlatform) => void
}

const fillStyle = {
  width: "100%",
  height: "100%",
  maxWidth: "none",
  maxHeight: "none",
} as const

const ORBIT_RADIUS_X = 132
const ORBIT_RADIUS_Y = 42
const ORBIT_DURATION = 28
const PAIR_TOTAL = 3

export function McpIconFan({
  productName,
  logoSrc,
  activePlatform,
  onPlatformSelect,
}: McpIconFanProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onSelectRef = useRef(onPlatformSelect)
  onSelectRef.current = onPlatformSelect

  useGSAP(
    (context, contextSafe) => {
      const root = rootRef.current
      if (!root || !contextSafe) return

      const brand = root.querySelector<HTMLElement>("[data-fan-brand]")
      const xMark = root.querySelector<HTMLElement>("[data-fan-x]")
      const orbitTiles = gsap.utils.toArray<HTMLElement>("[data-fan-orbit]")
      if (!brand || !xMark || !orbitTiles.length) return

      const n = orbitTiles.length
      const orbitProxy = { angle: 0 }
      let busy = false

      const orbitPose = (angleDeg: number, index: number) => {
        const theta = ((angleDeg + (360 / n) * index) * Math.PI) / 180
        const depth = (Math.sin(theta) + 1) / 2
        const inFront = depth > 0.5
        return {
          x: Math.cos(theta) * ORBIT_RADIUS_X,
          y: Math.sin(theta) * ORBIT_RADIUS_Y,
          z: -40 + depth * 100,
          scale: 0.68 + depth * 0.38,
          rotationY: -Math.cos(theta) * 18,
          rotationZ: Math.cos(theta) * 6,
          opacity: 0.5 + depth * 0.5,
          zIndex: inFront
            ? Math.round(31 + (depth - 0.5) * 50)
            : Math.round(5 + depth * 40),
        }
      }

      const placeOrbit = (angleDeg: number) => {
        orbitTiles.forEach((tile, i) => {
          gsap.set(tile, orbitPose(angleDeg, i))
        })
      }

      gsap.set([brand, ...orbitTiles], {
        transformPerspective: 900,
        transformOrigin: "50% 50%",
        xPercent: -50,
        yPercent: -50,
        left: "50%",
        top: "50%",
        position: "absolute",
      })
      gsap.set(brand, { x: 0, y: 0, z: 0, scale: 1, zIndex: 30, opacity: 1 })
      gsap.set(xMark, {
        xPercent: -50,
        yPercent: -50,
        left: "50%",
        top: "50%",
        position: "absolute",
        opacity: 0,
        scale: 0.6,
        zIndex: 80,
      })

      placeOrbit(0)

      gsap.from([brand, ...orbitTiles], {
        opacity: 0,
        scale: 0.55,
        duration: 0.75,
        stagger: { each: 0.045, from: "center" },
        ease: "power3.out",
        onComplete: () => {
          placeOrbit(orbitProxy.angle)
          gsap.set(brand, { opacity: 1, scale: 1 })
        },
      })

      const orbitTween = gsap.to(orbitProxy, {
        angle: 360,
        duration: ORBIT_DURATION,
        repeat: -1,
        ease: "none",
        onUpdate: () => placeOrbit(orbitProxy.angle),
      })

      const playPair = contextSafe((platform: McpConnectPlatform) => {
        if (busy) return
        const selected = orbitTiles.find((tile) => tile.dataset.platform === platform)
        if (!selected) return

        busy = true
        onSelectRef.current(platform)
        orbitTween.pause()

        const others = orbitTiles.filter((tile) => tile !== selected)
        const intro = 0.55
        const outro = 0.55
        const hold = Math.max(0.35, PAIR_TOTAL - intro - outro)

        const tl = gsap.timeline({
          onComplete: () => {
            placeOrbit(orbitProxy.angle)
            gsap.set(brand, { x: 0, y: 0, z: 0, scale: 1, zIndex: 30, opacity: 1 })
            gsap.set(xMark, { opacity: 0, scale: 0.6 })
            busy = false
            orbitTween.play()
          },
        })

        tl.to(
          others,
          {
            opacity: 0.1,
            scale: "-=0.15",
            duration: intro * 0.75,
            ease: "power2.inOut",
          },
          0,
        )
          .to(
            selected,
            {
              x: 54,
              y: 0,
              z: 60,
              scale: 0.8,
              rotationY: 0,
              rotationZ: 0,
              opacity: 1,
              zIndex: 70,
              duration: intro,
              ease: "power3.inOut",
            },
            0,
          )
          .to(
            brand,
            {
              x: -54,
              y: 0,
              z: 60,
              scale: 0.8,
              zIndex: 70,
              duration: intro,
              ease: "power3.inOut",
            },
            0,
          )
          .to(
            xMark,
            {
              opacity: 1,
              scale: 1,
              duration: intro * 0.55,
              ease: "back.out(1.7)",
            },
            intro * 0.3,
          )
          .to({}, { duration: hold })
          .addLabel("outro")
          .add(() => {
            orbitTiles.forEach((tile, i) => {
              gsap.to(tile, {
                ...orbitPose(orbitProxy.angle, i),
                duration: outro,
                ease: "power3.inOut",
              })
            })
          })
          .to(
            xMark,
            {
              opacity: 0,
              scale: 0.55,
              duration: outro * 0.4,
              ease: "power2.in",
            },
            "outro",
          )
          .to(
            brand,
            {
              x: 0,
              y: 0,
              scale: 1,
              duration: outro,
              ease: "power3.inOut",
            },
            "outro",
          )
          .to({}, { duration: outro })
      })

      const cleanups: Array<() => void> = []

      orbitTiles.forEach((tile) => {
        const onClick = () => {
          const platform = tile.dataset.platform as McpConnectPlatform | undefined
          if (platform) playPair(platform)
        }
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onClick()
          }
        }
        tile.addEventListener("click", onClick)
        tile.addEventListener("keydown", onKeyDown)
        cleanups.push(() => {
          tile.removeEventListener("click", onClick)
          tile.removeEventListener("keydown", onKeyDown)
        })
      })

      return () => {
        orbitTween.kill()
        cleanups.forEach((fn) => fn())
      }
    },
    { scope: rootRef },
  )

  return (
    <div
      ref={rootRef}
      className="relative mx-auto h-[9.5rem] w-full max-w-lg md:h-44"
      style={{ perspective: "1100px" }}
    >
      {FAN_SIDE_ICONS.map((item) => (
        <button
          key={item.id}
          type="button"
          data-fan-orbit
          data-platform={item.id}
          aria-label={`Select ${item.id}`}
          aria-pressed={activePlatform === item.id}
          className={cn(
            "size-14 cursor-pointer overflow-hidden rounded-2xl border-0 bg-transparent p-0 shadow-md outline-none md:size-16",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]",
            activePlatform === item.id && "ring-2 ring-primary/70",
          )}
        >
          <PlatformFanAvatar
            platform={item.id}
            size={64}
            className="block!"
            style={fillStyle}
          />
        </button>
      ))}

      <div
        data-fan-brand
        className="pointer-events-none size-[4.25rem] overflow-hidden rounded-[1.15rem] bg-primary shadow-md md:size-[4.75rem]"
      >
        <Image
          src={logoSrc}
          alt={productName}
          width={76}
          height={76}
          className="size-full object-contain p-3"
          priority
        />
      </div>

      <div
        data-fan-x
        className="pointer-events-none flex size-8 items-center justify-center text-white/85"
        aria-hidden
      >
        <X className="size-5" weight="bold" />
      </div>
    </div>
  )
}
