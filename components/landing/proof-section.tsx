"use client"

import Image from "next/image"
import type { CSSProperties } from "react"

const PROOF_IMAGES = [
  "/influencer_proof_showcases/Copy of Screenshot_20260113_150433_Instagram.jpg",
  "/influencer_proof_showcases/Copy of Screenshot_20260118_112200_Instagram.jpg",
  "/influencer_proof_showcases/Copy of Screenshot_20260301_172839_Instagram.jpg",
  "/influencer_proof_showcases/Copy of Screenshot_20260411_223900_TikTok.jpg",
  "/influencer_proof_showcases/Copy of Screenshot_20260412_010914_Instagram.jpg",
  "/influencer_proof_showcases/Screenshot_20260312_202935_Instagram (1).jpg",
  "/influencer_proof_showcases/Screenshot_20260413_101303_TikTok.jpg",
  "/influencer_proof_showcases/Screenshot_20260426_010555_Instagram.jpg",
] as const

/*
Legacy proof section kept commented out per request.

const PROOF_IMAGES = [
  "/insta_proof/insta_proof_showcase_iphone/Screenshot-iPhone15 Pro Max-1-ss1.png",
  "/insta_proof/insta_proof_showcase_iphone/Screenshot-iPhone15 Pro Maxss-ss3.png",
] as const

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
      <div className="relative aspect-9/18 w-full overflow-x-hidden [--proof-img-w:min(122vw,760px)] md:aspect-9/10 md:[--proof-img-w:min(72vw,480px)] lg:aspect-auto lg:flex lg:min-h-0 lg:flex-row lg:items-center">
        ...
      </div>
    </section>
  )
}
*/

type ProofMarqueeProps = {
  images: readonly string[]
  priority?: boolean
}

function ProofMarquee({ images, priority = false }: ProofMarqueeProps) {
  const marqueeImages = [...images, ...images]

  return (
    <div className="proof-marquee-lane relative h-[var(--proof-card-height)] overflow-hidden" aria-label="Scrolling proof screenshots">
      <div className="proof-marquee-track proof-marquee-scroll inline-flex h-full min-w-max flex-row flex-nowrap items-stretch gap-[var(--proof-gap)]">
        {marqueeImages.map((imageSrc, index) => (
        <article
          key={`${index}-${imageSrc}`}
          className="relative h-[var(--proof-card-height)] w-[var(--proof-card-width)] shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm"
        >
          <div className="relative h-full w-full overflow-hidden bg-muted/30">
            <Image
              src={encodeURI(imageSrc)}
              alt={`Proof showcase screenshot ${index + 1}`}
              width={1080}
              height={1920}
              className="h-full w-full object-cover object-top"
              priority={priority && index < 2}
              sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 18vw, (min-width: 768px) 22vw, 42vw"
            />
          </div>
        </article>
        ))}
      </div>
    </div>
  )
}

export function ProofSection() {
  return (
    <section
      id="proof"
      className="relative overflow-hidden bg-background py-16 sm:py-24"
      style={
        {
          "--proof-gap": "1rem",
          "--proof-card-width": "clamp(160px, 16vw, 210px)",
          "--proof-card-height": "clamp(285px, 29vw, 373px)",
          "--proof-edge-fade": "clamp(34px, 12vw, 112px)",
        } as CSSProperties
      }
    >
      {/*
      <section
        id="proof"
        className="relative w-full overflow-x-hidden bg-background py-0"
      >
        Old proof showcase intentionally kept here and commented out.
      </section>
      */}

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Creators are already using this technology to get an unfair advantage
          </h2>
        </div>

        <div className="proof-marquee-shell relative mt-10 overflow-hidden bg-background">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[var(--proof-edge-fade)] bg-gradient-to-r from-background via-background via-55% to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[var(--proof-edge-fade)] bg-gradient-to-l from-background via-background via-55% to-transparent" />
          <ProofMarquee images={PROOF_IMAGES} priority />
        </div>
      </div>

      <style jsx global>{`
        .proof-marquee-shell {
          isolation: isolate;
        }

        .proof-marquee-lane {
          position: relative;
          height: var(--proof-card-height);
          overflow: hidden;
          -webkit-mask-image: linear-gradient(
            90deg,
            transparent 0,
            black calc(var(--proof-edge-fade) * 0.92),
            black calc(100% - (var(--proof-edge-fade) * 0.92)),
            transparent 100%
          );
          mask-image: linear-gradient(
            90deg,
            transparent 0,
            black calc(var(--proof-edge-fade) * 0.92),
            black calc(100% - (var(--proof-edge-fade) * 0.92)),
            transparent 100%
          );
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
        }

        .proof-marquee-track {
          min-width: max-content;
          will-change: transform;
        }

        .proof-marquee-scroll {
          animation: proof-marquee-right 34s linear infinite;
        }

        .proof-marquee-lane:hover .proof-marquee-scroll {
          animation-play-state: paused;
        }

        @keyframes proof-marquee-right {
          from {
            transform: translate3d(calc(-50% - (var(--proof-gap) / 2)), 0, 0);
          }
          to {
            transform: translate3d(0, 0, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .proof-marquee-scroll {
            animation-duration: 0.01ms;
            animation-iteration-count: 1;
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>
    </section>
  )
}
