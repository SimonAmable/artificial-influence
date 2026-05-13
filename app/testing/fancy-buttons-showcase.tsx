'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

const GRAIN_TILE = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves="4" stitchTiles="stitch" seed="93"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="0.5"/></svg>`,
)

function rnd(lo: number, hi: number) {
  return lo + Math.random() * (hi - lo)
}

function clampHue(value: number) {
  let h = value % 360
  if (h < 0) h += 360
  return h
}

function hsla(h: number, s: number, l: number, a: number) {
  return `hsla(${clampHue(h)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a})`
}

function pickOrbHue(kind: 'prism' | 'ember', index: number) {
  if (kind === 'prism') return rnd(195 + index * 3, 330)
  return Math.random() < 0.58 ? rnd(2, 68) + rnd(-15, 15) : rnd(278, 345)
}

function orbColor(kind: 'prism' | 'ember', i: number) {
  const h = pickOrbHue(kind, i)
  return hsla(h, rnd(68, 92), rnd(53, 70), rnd(0.19, 0.44))
}

function moteColor(kind: 'prism' | 'ember', i: number) {
  const h =
    kind === 'prism'
      ? rnd(205, 320) + (i === 2 ? rnd(-55, 55) : 0)
      : Math.random() < 0.5
        ? rnd(8, 58)
        : rnd(298, 340)
  const l = rnd(71, 93)
  return hsla(h, rnd(74, 100), l, rnd(0.78, 0.98))
}

const CHAOS_ORB_NAMES = ['testing-chaos-p1', 'testing-chaos-p2', 'testing-chaos-p3', 'testing-chaos-p4'] as const
const CHAOS_SPARK_NAMES = ['testing-chaos-s1', 'testing-chaos-s2', 'testing-chaos-s3', 'testing-chaos-s4'] as const
const BEZ_ORB_POOL = ['cubic-bezier(0.2, 0.9, 0.3, 0.06)', 'cubic-bezier(0.45, 0.02, 0.52, 0.92)', 'cubic-bezier(0.36, -0.12, 0.62, 1.18)', 'cubic-bezier(0.55, 0.15, 0.25, 0.95)'] as const

type ChaosKind = 'prism' | 'ember'

type ChaosOrbDir = 'alternate' | 'alternate-reverse'

interface ChaosMotionSpec {
  borderColor: string
  orbPalettes: string[]
  sparkPalettes: string[]
  orbDurations: number[]
  orbDelays: number[]
  orbEase: string[]
  orbDir: ChaosOrbDir[]
  sparkDurations: number[]
  sparkDelays: number[]
  sparkEase: string[]
  grainDu: number
  hueRollDu: number
  grainDelay: number
  grainOpacity: number
  grainPx: number
  sparkFrozenOpacity: number[]
}

function pickSparkEase() {
  if (Math.random() < 0.38) return `steps(${Math.floor(rnd(4, 11))}, jump-end)`
  return BEZ_ORB_POOL[Math.floor(Math.random() * BEZ_ORB_POOL.length)] ?? BEZ_ORB_POOL[0]
}

function orbDirRoll(): ChaosOrbDir {
  return Math.random() < 0.5 ? 'alternate' : 'alternate-reverse'
}

/** Stable first paint — matches server markup for hydration-safe chaos buttons. */
const STATIC_CHAOS: Record<ChaosKind, ChaosMotionSpec> = {
  prism: {
    borderColor: hsla(262, 78, 71, 0.32),
    orbPalettes: [
      hsla(214, 86, 60, 0.3),
      hsla(288, 78, 60, 0.31),
      hsla(198, 92, 57, 0.26),
      hsla(235, 80, 64, 0.24),
    ],
    sparkPalettes: [
      hsla(200, 100, 86, 0.88),
      hsla(274, 100, 90, 0.86),
      hsla(190, 100, 86, 0.85),
      hsla(250, 100, 90, 0.82),
    ],
    orbDurations: [17.9, 15.8, 20.9, 12.25],
    orbDelays: [-8.95, -3.72, -6.82, -4],
    orbEase: [...BEZ_ORB_POOL],
    orbDir: ['alternate', 'alternate-reverse', 'alternate-reverse', 'alternate'],
    sparkDurations: [6.58, 5.94, 7.94, 6.92],
    sparkDelays: [-2.94, -1.25, -2.92, -3],
    sparkEase: [...BEZ_ORB_POOL],
    grainDu: 27.92,
    hueRollDu: 96.92,
    grainDelay: -6.94,
    grainOpacity: 0.22,
    grainPx: 58,
    sparkFrozenOpacity: [0.43, 0.47, 0.42, 0.45],
  },
  ember: {
    borderColor: hsla(24, 90, 64, 0.37),
    orbPalettes: [
      hsla(18, 92, 59, 0.41),
      hsla(342, 86, 55, 0.39),
      hsla(348, 80, 55, 0.38),
      hsla(32, 90, 55, 0.42),
    ],
    sparkPalettes: [
      hsla(43, 100, 73, 0.93),
      hsla(354, 100, 71, 0.93),
      hsla(292, 100, 74, 0.93),
      hsla(26, 100, 71, 0.93),
    ],
    orbDurations: [15.94, 19.94, 12.94, 18.94],
    orbDelays: [-5.94, -4.94, -2.94, -6.94],
    orbEase: [...BEZ_ORB_POOL],
    orbDir: ['alternate-reverse', 'alternate', 'alternate', 'alternate-reverse'],
    sparkDurations: [5.94, 4.94, 7.94, 6.94],
    sparkDelays: [-4.94, -1.94, -6.94, -2],
    sparkEase: [...BEZ_ORB_POOL],
    grainDu: 33.94,
    hueRollDu: 128.94,
    grainDelay: -8,
    grainOpacity: 0.19,
    grainPx: 60,
    sparkFrozenOpacity: [0.52, 0.48, 0.53, 0.5],
  },
}

function buildLiveChaosSpec(kind: ChaosKind): ChaosMotionSpec {
  const orbPalettes = Array.from({ length: 4 }, (_, i) => orbColor(kind, i))
  const sparkPalettes = Array.from({ length: 4 }, (_, i) => moteColor(kind, i))
  const borderH = pickOrbHue(kind, 5)
  const borderColor = hsla(borderH, rnd(62, 86), rnd(54, 78), rnd(0.21, 0.44))

  const orbDurations = Array.from({ length: 4 }, () => rnd(9.2, 25.85))
  const orbDelays = orbDurations.map((d) => rnd(-d, 0))
  const orbEase = Array.from({ length: 4 }, (_, ix) =>
    ix % 2 === 0 && Math.random() < 0.2
      ? `cubic-bezier(${rnd(0.12, 0.55)}, ${rnd(-0.4, 0.9)}, ${rnd(0.15, 0.94)}, ${rnd(0.45, 1.45)})`
      : BEZ_ORB_POOL[Math.floor(Math.random() * BEZ_ORB_POOL.length)]!,
  )
  const orbDir = Array.from({ length: 4 }, () => orbDirRoll())

  const sparkDurations = Array.from({ length: 4 }, () => rnd(3.1, 10.94))
  const sparkDelays = sparkDurations.map((d) => rnd(-d, -0.05))
  const sparkEase = Array.from({ length: 4 }, () => pickSparkEase())

  const grainDu = rnd(14.94, 39.94)
  const hueRollDu = rnd(58, 154)
  const grainDelay = rnd(-grainDu, 0)

  const sparkFrozenOpacity = Array.from({ length: 4 }, () => rnd(0.38, 0.6))

  return {
    borderColor,
    orbPalettes,
    sparkPalettes,
    orbDurations,
    orbDelays,
    orbEase,
    orbDir,
    sparkDurations,
    sparkDelays,
    sparkEase,
    grainDu,
    hueRollDu,
    grainDelay,
    grainOpacity: rnd(kind === 'prism' ? 0.17 : 0.14, kind === 'prism' ? 0.34 : 0.28),
    grainPx: Math.round(rnd(44, 78)),
    sparkFrozenOpacity,
  }
}

function useReducedMotionFlag() {
  const [prefersReduced, setPrefersReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(mq.matches)
    const onChange = () => setPrefersReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return prefersReduced
}

function ChaosFieldButton({
  kind,
  children,
}: {
  kind: ChaosKind
  children: React.ReactNode
}) {
  const prefersReducedMotion = useReducedMotionFlag()
  const [spec, setSpec] = useState<ChaosMotionSpec>(() => STATIC_CHAOS[kind])

  useEffect(() => {
    setSpec(buildLiveChaosSpec(kind))
  }, [kind])

  const prismShell = kind === 'prism'
  const shell = prismShell
    ? 'rounded-xl border border-white/22 bg-neutral-950/88 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_0_rgba(0,0,0,0.52)] hover:border-white/34'
    : 'rounded-xl border border-white/[0.09] bg-zinc-950/92 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_0_rgba(10,10,12,0.55)] hover:border-orange-400/34'

  const grainLayerStyle: CSSProperties =
    prefersReducedMotion
      ? {
          opacity: spec.grainOpacity * 0.55,
          backgroundImage: `url("data:image/svg+xml,${GRAIN_TILE}")`,
          backgroundSize: `${spec.grainPx}px`,
        }
      : {
          opacity: spec.grainOpacity,
          backgroundImage: `url("data:image/svg+xml,${GRAIN_TILE}")`,
          backgroundSize: `${spec.grainPx}px`,
          animation: `testing-chaos-grain-twist ${spec.grainDu.toFixed(4)}s linear infinite, testing-chaos-hue-roll ${spec.hueRollDu.toFixed(4)}s linear infinite`,
          animationDelay: `${spec.grainDelay.toFixed(4)}s`,
          filter: 'brightness(1.08)',
        }

  type OrbIx = 0 | 1 | 2 | 3
  type SparkIx = 0 | 1 | 2 | 3

  const orbPos: Record<OrbIx, { className: string; blur: string }> = {
    0: {
      className: 'pointer-events-none absolute left-[-10%] top-[-42%] h-[158%] w-[88%]',
      blur: 'blur-3xl',
    },
    1: {
      className: 'pointer-events-none absolute bottom-[-42%] right-[-12%] h-[150%] w-[98%]',
      blur: 'blur-[44px]',
    },
    2: {
      className:
        'pointer-events-none absolute left-1/2 top-[62%] h-[118%] w-[76%] -translate-x-1/2',
      blur: 'blur-[52px]',
    },
    3: {
      className:
        'pointer-events-none absolute left-[60%] top-[18%] h-[74%] w-[74%] -translate-x-1/2',
      blur: 'blur-2xl',
    },
  }

  const sparkPos: Record<SparkIx, { className: string; blur: string }> = {
    0: {
      className: 'pointer-events-none absolute left-[20%] top-[36%] h-10 w-10',
      blur: 'blur-[7px]',
    },
    1: {
      className: 'pointer-events-none absolute left-[73%] top-[39%] h-11 w-11',
      blur: 'blur-[8px]',
    },
    2: {
      className: 'pointer-events-none absolute left-[53%] top-[66%] h-11 w-11',
      blur: 'blur-md',
    },
    3: {
      className: 'pointer-events-none absolute left-[43%] top-[20%] h-11 w-11',
      blur: 'blur-[5px]',
    },
  }

  return (
    <button
      type="button"
      className={`group relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden px-8 py-3.75 transition-[border-color,box-shadow,transform,background-color] hover:-translate-y-px active:translate-y-0 motion-reduce:transition-colors motion-reduce:hover:translate-y-0 ${shell}`}
      style={{ borderColor: spec.borderColor }}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute -inset-10 rounded-inherit bg-repeat motion-reduce:animate-none ${prismShell ? 'mix-blend-overlay' : 'mix-blend-screen'}`}
        style={grainLayerStyle}
      />

      {([0, 1, 2, 3] as const).map((i) => (
        <span
          aria-hidden
          key={`orb-${i}`}
          className={`motion-reduce:animate-none ${orbPos[i].className} rounded-full bg-transparent ${orbPos[i].blur} motion-reduce:opacity-[0.62]`}
          style={
            prefersReducedMotion
              ? { backgroundColor: spec.orbPalettes[i] }
              : {
                  backgroundColor: spec.orbPalettes[i],
                  animationName: CHAOS_ORB_NAMES[i] ?? CHAOS_ORB_NAMES[0],
                  animationDuration: `${spec.orbDurations[i]?.toFixed(4)}s`,
                  animationTimingFunction: spec.orbEase[i]!,
                  animationDelay: `${spec.orbDelays[i]?.toFixed(4)}s`,
                  animationIterationCount: 'infinite',
                  animationDirection: spec.orbDir[i]!,
                }
          }
        />
      ))}

      {([0, 1, 2, 3] as const).map((i) => (
        <span
          aria-hidden
          key={`spark-${i}`}
          className={`${sparkPos[i].className} motion-reduce:animate-none rounded-full mix-blend-plus-lighter ${sparkPos[i].blur}`}
          style={
            prefersReducedMotion
              ? {
                  opacity: spec.sparkFrozenOpacity[i],
                  backgroundColor: spec.sparkPalettes[i],
                }
              : {
                  backgroundColor: spec.sparkPalettes[i],
                  animationName: CHAOS_SPARK_NAMES[i] ?? CHAOS_SPARK_NAMES[0],
                  animationDuration: `${spec.sparkDurations[i]?.toFixed(4)}s`,
                  animationTimingFunction: spec.sparkEase[i]!,
                  animationDelay: `${spec.sparkDelays[i]?.toFixed(4)}s`,
                  animationIterationCount: 'infinite',
                }
          }
        />
      ))}

      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 rounded-inherit opacity-93 ${prismShell ? 'shadow-[inset_0_0_48px_rgba(0,0,0,0.8)]' : 'shadow-[inset_0_0_40px_rgba(16,14,22,0.86),inset_0_-12px_34px_-20px_rgba(220,120,74,0.1)]'}`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-px rounded-inherit ${prismShell ? 'opacity-[0.76] bg-[radial-gradient(120%_92%_at_48%_-8%,rgba(255,255,255,0.1)_0%,transparent_62%)]' : 'opacity-72 bg-[radial-gradient(120%_90%_at_62%_-6%,rgba(255,237,216,0.12)_0%,transparent_62%)]'}`}
      />

      <span
        className={`relative z-10 shrink-0 text-[15px] font-medium tracking-tight ${prismShell ? 'text-zinc-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]' : 'text-amber-50 drop-shadow-[0_2px_6px_rgba(12,10,8,0.95)]'} transition-colors`}
      >
        {children}
      </span>
    </button>
  )
}

/** Scoped keyframes — chaos (#9–10), grain field (#2–3), aurora halo (#8). */
const showcaseStyles = `
  @keyframes testing-glow-shift {
    0%, 100% { opacity: 0.85; transform: translate(0%, 0%) scale(1); }
    33% { opacity: 1; transform: translate(15%, -8%) scale(1.15); }
    66% { opacity: 0.9; transform: translate(-10%, 6%) scale(1.08); }
  }

  @keyframes testing-grain-drift {
    0% { transform: rotate(0deg) translate3d(0, 0, 0) scale(1); }
    33% { transform: rotate(-4deg) translate3d(-5%, 3%, 0) scale(1.08); }
    66% { transform: rotate(3deg) translate3d(4%, -3%, 0) scale(0.96); }
    100% { transform: rotate(0deg) translate3d(0, 0, 0) scale(1); }
  }

  @keyframes testing-orb-a {
    0%, 100% { transform: translate3d(-12%, -28%, 0) scale(1); opacity: 0.74; }
    40% { transform: translate3d(52%, 32%, 0) scale(1.32); opacity: 0.96; }
    72% { transform: translate3d(8%, 68%, 0) scale(1); opacity: 0.78; }
  }
  @keyframes testing-orb-b {
    0%, 100% { transform: translate3d(48%, -12%, 0) scale(1.05); opacity: 0.58; }
    45% { transform: translate3d(-34%, 38%, 0) scale(1.45); opacity: 0.88; }
    72% { transform: translate3d(22%, -5%, 0) scale(1); opacity: 0.66; }
  }
  @keyframes testing-orb-c {
    0%, 100% { transform: translate3d(-32%, 48%, 0) scale(1.12); opacity: 0.48; }
    50% { transform: translate3d(48%, -28%, 0) scale(0.9); opacity: 0.8; }
  }
  @keyframes testing-orb-d {
    0%, 100% { transform: translate3d(18%, 22%, 0) scale(0.88); opacity: 0.32; }
    50% { transform: translate3d(-26%, -16%, 0) scale(1.38); opacity: 0.52; }
  }

  @keyframes testing-mote-1 {
    0%, 100% { opacity: 0; transform: translate3d(-8px, 6px, 0) scale(0.42); }
    24% { opacity: 1; transform: translate3d(20px, -16px, 0) scale(1.12); }
    50% { opacity: 0.48; transform: translate3d(36px, 8px, 0) scale(0.82); }
  }

  @keyframes testing-mote-2 {
    0%, 100% { opacity: 0; transform: translate3d(14px, 4px, 0) scale(0.52); }
    32% { opacity: 0.92; transform: translate3d(-26px, -22px, 0) scale(1.18); }
    60% { opacity: 0.28; transform: translate3d(-12px, 14px, 0) scale(0.74); }
  }
  @keyframes testing-mote-3 {
    0%, 100% { opacity: 0; transform: translate3d(30px, -10px, 0) scale(0.5); }
    28% { opacity: 1; transform: translate3d(-8px, 20px, 0) scale(1.06); }
    64% { opacity: 0.4; transform: translate3d(-32px, -8px, 0) scale(0.76); }
  }
  @keyframes testing-mote-4 {
    0%, 100% { opacity: 0; transform: translate3d(-24px, -14px, 0) scale(0.58); }
    36% { opacity: 0.84; transform: translate3d(10px, 24px, 0) scale(1.04); }
    69% { opacity: 0.2; transform: translate3d(38px, 6px, 0) scale(0.66); }
  }

  @keyframes testing-chaos-grain-twist {
    0%, 100% { transform: rotate(0deg) translate3d(0, 0, 0) scale(1); }
    11% { transform: rotate(-5deg) translate3d(5%, -2%, 0) scale(1.08); }
    24% { transform: rotate(4deg) translate3d(-4%, 3%, 0) scale(0.94); }
    43% { transform: rotate(-2deg) translate3d(6%, 4%, 0) scale(1.05); }
    61% { transform: rotate(3deg) translate3d(-3%, -6%, 0) scale(0.98); }
    79% { transform: rotate(-4deg) translate3d(2%, 3%, 0) scale(1.04); }
    93% { transform: rotate(1deg) translate3d(-2%, -1%, 0) scale(0.96); }
  }

  @keyframes testing-chaos-hue-roll {
    0% { filter: hue-rotate(0deg) brightness(1.08); }
    43% { filter: hue-rotate(212deg) brightness(1.11); }
    100% { filter: hue-rotate(360deg) brightness(1.08); }
  }

  @keyframes testing-chaos-p1 {
    0%, 100% { transform: translate3d(-22%, -36%, 0) scale(0.78); opacity: 0.28; }
    8% { transform: translate3d(61%, 19%, 0) scale(1.44); opacity: 0.96; }
    21% { transform: translate3d(9%, 80%, 0) scale(0.62); opacity: 0.38; }
    36% { transform: translate3d(-53%, 6%, 0) scale(1.32); opacity: 0.9; }
    52% { transform: translate3d(54%, 58%, 0) scale(0.88); opacity: 0.52; }
    69% { transform: translate3d(-14%, -24%, 0) scale(1.4); opacity: 0.82; }
    84% { transform: translate3d(39%, -32%, 0) scale(0.72); opacity: 0.42; }
  }
  @keyframes testing-chaos-p2 {
    0%, 100% { transform: translate3d(49%, -20%, 0) scale(1.04); opacity: 0.48; }
    13% { transform: translate3d(-41%, 41%, 0) scale(0.76); opacity: 0.92; }
    27% { transform: translate3d(28%, -6%, 0) scale(1.48); opacity: 0.32; }
    44% { transform: translate3d(-54%, -24%, 0) scale(0.84); opacity: 0.8; }
    61% { transform: translate3d(46%, 66%, 0) scale(1.06); opacity: 0.58; }
    78% { transform: translate3d(6%, 14%, 0) scale(0.68); opacity: 0.86; }
    93% { transform: translate3d(-32%, -14%, 0) scale(1.22); opacity: 0.55; }
  }
  @keyframes testing-chaos-p3 {
    0%, 100% { transform: translate3d(-36%, 46%, 0) scale(1.08); opacity: 0.4; }
    17% { transform: translate3d(48%, -32%, 0) scale(0.74); opacity: 0.9; }
    33% { transform: translate3d(-26%, -16%, 0) scale(1.5); opacity: 0.3; }
    51% { transform: translate3d(58%, 54%, 0) scale(0.9); opacity: 0.78; }
    68% { transform: translate3d(-52%, 22%, 0) scale(1.3); opacity: 0.5; }
    82% { transform: translate3d(22%, -48%, 0) scale(0.7); opacity: 0.88; }
    94% { transform: translate3d(-6%, 74%, 0) scale(1.12); opacity: 0.46; }
  }
  @keyframes testing-chaos-p4 {
    0%, 100% { transform: translate3d(16%, 24%, 0) scale(0.86); opacity: 0.28; }
    12% { transform: translate3d(-52%, -18%, 0) scale(1.52); opacity: 0.64; }
    26% { transform: translate3d(44%, 48%, 0) scale(0.7); opacity: 0.9; }
    41% { transform: translate3d(-28%, -38%, 0) scale(1.2); opacity: 0.35; }
    57% { transform: translate3d(62%, 12%, 0) scale(0.98); opacity: 0.72; }
    74% { transform: translate3d(-18%, 68%, 0) scale(1.14); opacity: 0.54; }
    91% { transform: translate3d(30%, -8%, 0) scale(0.64); opacity: 0.86; }
  }

  @keyframes testing-chaos-s1 {
    0%, 100% { opacity: 0; transform: translate3d(0px, 0px, 0) scale(0.3); }
    6% { opacity: 1; transform: translate3d(34px, -26px, 0) scale(1.26); }
    14% { opacity: 0.12; transform: translate3d(-22px, -6px, 0) scale(0.42); }
    24% { opacity: 0.9; transform: translate3d(10px, 32px, 0) scale(1.1); }
    35% { opacity: 0.05; transform: translate3d(48px, 14px, 0) scale(0.64); }
    48% { opacity: 0.78; transform: translate3d(-30px, -22px, 0) scale(1.22); }
    62% { opacity: 0.18; transform: translate3d(16px, -36px, 0) scale(0.48); }
    79% { opacity: 0.92; transform: translate3d(-44px, 22px, 0) scale(1.06); }
    93% { opacity: 0.28; transform: translate3d(28px, 8px, 0) scale(0.78); }
  }
  @keyframes testing-chaos-s2 {
    0%, 100% { opacity: 0; transform: translate3d(12px, 6px, 0) scale(0.52); }
    8% { opacity: 1; transform: translate3d(-42px, -28px, 0) scale(1.18); }
    19% { opacity: 0.3; transform: translate3d(26px, 18px, 0) scale(0.5); }
    31% { opacity: 0.94; transform: translate3d(-8px, -36px, 0) scale(1.12); }
    44% { opacity: 0.08; transform: translate3d(52px, 4px, 0) scale(0.74); }
    58% { opacity: 0.82; transform: translate3d(-36px, 28px, 0) scale(1); }
    73% { opacity: 0.16; transform: translate3d(18px, -18px, 0) scale(1.42); }
    88% { opacity: 0.88; transform: translate3d(-24px, -10px, 0) scale(0.58); }
  }
  @keyframes testing-chaos-s3 {
    0%, 100% { opacity: 0; transform: translate3d(-8px, -10px, 0) scale(0.44); }
    9% { opacity: 0.94; transform: translate3d(46px, 12px, 0) scale(1.2); }
    21% { opacity: 0.2; transform: translate3d(-28px, 36px, 0) scale(0.56); }
    34% { opacity: 1; transform: translate3d(6px, -30px, 0) scale(1.28); }
    47% { opacity: 0.1; transform: translate3d(-54px, -6px, 0) scale(0.38); }
    61% { opacity: 0.72; transform: translate3d(32px, 28px, 0) scale(1.08); }
    76% { opacity: 0.26; transform: translate3d(-14px, 48px, 0) scale(0.64); }
    91% { opacity: 0.9; transform: translate3d(40px, -16px, 0) scale(1.06); }
  }
  @keyframes testing-chaos-s4 {
    0%, 100% { opacity: 0; transform: translate3d(-32px, 10px, 0) scale(0.58); }
    11% { opacity: 0.92; transform: translate3d(22px, -22px, 0) scale(1.18); }
    26% { opacity: 0.14; transform: translate3d(38px, 24px, 0) scale(0.46); }
    39% { opacity: 0.98; transform: translate3d(-48px, -18px, 0) scale(1.32); }
    54% { opacity: 0.22; transform: translate3d(14px, 42px, 0) scale(0.7); }
    69% { opacity: 0.86; transform: translate3d(-22px, -34px, 0) scale(1.14); }
    84% { opacity: 0.18; transform: translate3d(56px, 6px, 0) scale(0.52); }
  }

  .testing-grain-spin {
    animation: testing-grain-drift 20s cubic-bezier(0.42, 0, 0.58, 1) infinite;
  }
  .testing-orbit-a {
    animation: testing-orb-a 17s cubic-bezier(0.45, 0.06, 0.55, 0.94) infinite alternate;
  }
  .testing-orbit-b {
    animation: testing-orb-b 13.8s cubic-bezier(0.45, 0.06, 0.55, 0.94) infinite alternate;
    animation-delay: -5.5s;
  }
  .testing-orbit-c {
    animation: testing-orb-c 22s cubic-bezier(0.45, 0.06, 0.55, 0.94) infinite alternate;
    animation-delay: -3.2s;
  }
  .testing-orbit-d {
    animation: testing-orb-d 11s cubic-bezier(0.45, 0.06, 0.55, 0.94) infinite alternate;
    animation-delay: -7.4s;
  }
  .testing-mote-1 {
    animation: testing-mote-1 5.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }
  .testing-mote-2 {
    animation: testing-mote-2 6.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    animation-delay: -2s;
  }
  .testing-mote-3 {
    animation: testing-mote-3 7.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    animation-delay: -1.3s;
  }
  .testing-mote-4 {
    animation: testing-mote-4 9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    animation-delay: -4.2s;
  }

  .testing-animate-glow-blob {
    animation: testing-glow-shift 4.5s ease-in-out infinite;
  }
`

type GrainFieldVariant = 'obsidian' | 'cryo'

function GrainFieldButton({
  variant,
  children,
}: {
  variant: GrainFieldVariant
  children: React.ReactNode
}) {
  const cryo = variant === 'cryo'
  const shell = cryo
    ? 'rounded-xl border border-white/22 bg-white/5 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_14px_40px_-22px_rgba(56,189,248,0.32)] hover:border-white/32 hover:bg-white/[0.08]'
    : 'rounded-xl border border-white/13 bg-neutral-950/93 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_0_rgba(0,0,0,0.5),inset_0_0_52px_rgba(0,0,0,0.72)] hover:border-white/21'

  return (
    <button
      type="button"
      className={`group relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden px-8 py-3.75 transition-[border-color,box-shadow,transform,background-color] hover:-translate-y-px active:translate-y-0 motion-reduce:transition-colors motion-reduce:hover:translate-y-0 ${shell}`}
    >
      {/* Drifting procedural grain */}
      <span
        aria-hidden
        className={`testing-grain-spin pointer-events-none absolute -inset-10 rounded-inherit bg-repeat motion-reduce:animate-none ${cryo ? 'opacity-20 mix-blend-overlay motion-reduce:opacity-[0.11]' : 'opacity-14 mix-blend-overlay motion-reduce:opacity-[0.085]'}`}
        style={{
          backgroundImage: `url("data:image/svg+xml,${GRAIN_TILE}")`,
          backgroundSize: '56px 56px',
        }}
      />

      {/* Large luminous gradient bodies */}
      <span
        aria-hidden
        className={`testing-orbit-a pointer-events-none absolute left-[-10%] top-[-42%] h-[158%] w-[88%] rounded-full blur-3xl motion-reduce:animate-none motion-reduce:opacity-70 ${cryo ? 'bg-sky-400/26' : 'bg-cyan-400/26'}`}
      />
      <span
        aria-hidden
        className={`testing-orbit-b pointer-events-none absolute bottom-[-42%] right-[-12%] h-[150%] w-[98%] rounded-full blur-[44px] motion-reduce:animate-none motion-reduce:opacity-60 ${cryo ? 'bg-violet-300/24' : 'bg-violet-500/25'}`}
      />
      <span
        aria-hidden
        className={`testing-orbit-c pointer-events-none absolute left-1/2 top-[62%] h-[118%] w-[76%] -translate-x-1/2 rounded-full blur-[52px] motion-reduce:animate-none motion-reduce:opacity-50 ${cryo ? 'bg-teal-200/20' : 'bg-fuchsia-500/21'}`}
      />
      <span
        aria-hidden
        className={`testing-orbit-d pointer-events-none absolute left-[60%] top-[18%] h-[74%] w-[74%] -translate-x-1/2 rounded-full blur-2xl motion-reduce:animate-none motion-reduce:opacity-40 ${cryo ? 'bg-white/11' : 'bg-blue-500/21'}`}
      />

      {/* Micro glowing grains */}
      <span
        aria-hidden
        className={`testing-mote-1 pointer-events-none absolute left-[20%] top-[36%] h-10 w-10 rounded-full mix-blend-plus-lighter blur-[6px] motion-reduce:animate-none ${cryo ? 'bg-sky-100/95' : 'bg-cyan-200/93'}`}
      />
      <span
        aria-hidden
        className={`testing-mote-2 pointer-events-none absolute left-[73%] top-[40%] h-11 w-11 rounded-full mix-blend-plus-lighter blur-[7px] motion-reduce:animate-none ${cryo ? 'bg-white/92' : 'bg-violet-200/94'}`}
      />
      <span
        aria-hidden
        className={`testing-mote-3 pointer-events-none absolute left-[53%] top-[66%] h-11 w-11 rounded-full mix-blend-plus-lighter blur-md motion-reduce:animate-none ${cryo ? 'bg-sky-200/90' : 'bg-teal-200/93'}`}
      />
      <span
        aria-hidden
        className={`testing-mote-4 pointer-events-none absolute left-[43%] top-[20%] h-11 w-11 rounded-full mix-blend-plus-lighter blur-[5px] motion-reduce:animate-none ${cryo ? 'bg-indigo-100/88' : 'bg-fuchsia-200/93'}`}
      />

      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 rounded-inherit ${cryo ? 'shadow-[inset_0_0_36px_rgba(56,189,248,0.06),inset_0_0_56px_rgba(15,23,42,0.35)] opacity-96' : 'shadow-[inset_0_0_56px_rgba(0,0,0,0.82)] opacity-94'}`}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-px rounded-inherit opacity-85 bg-[radial-gradient(118%_88%_at_48%_-6%,rgba(255,255,255,0.08)_0%,transparent_62%)]"
      />

      <span
        className={`relative z-10 shrink-0 text-[15px] font-medium tracking-tight ${cryo ? 'text-white drop-shadow-[0_1px_14px_rgba(14,165,233,0.22)]' : 'text-zinc-50 drop-shadow-[0_2px_3px_rgba(0,0,0,0.78)]'} transition-colors`}
      >
        {children}
      </span>
    </button>
  )
}

function ShowcaseCard({
  title,
  description,
  subtle,
  children,
}: {
  title: string
  description: string
  subtle?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border p-8 ${
        subtle
          ? 'border-transparent bg-muted/30'
          : 'border-border/80 bg-card/40'
      }`}
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
      <div className="flex min-h-19 flex-wrap items-center justify-center gap-4">
        {children}
      </div>
    </div>
  )
}

export function FancyButtonsShowcase() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: showcaseStyles }} />

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14">
        <header className="text-center md:text-left">
          <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-[0.2em]">
            /testing
          </p>
          <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            Button playground
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl md:mx-0">
            Ten tuning posts for dark shells — chaotic grain fields reroll random palettes client-side after
            the first paint, plus glass, shimmer, neon, and chrome staples.
          </p>
          <Link
            href="/"
            className="text-primary mt-6 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            Back home
            <ArrowRight className="size-3.5" />
          </Link>
        </header>

        <div className="grid gap-8 md:grid-cols-2">
          {/* 1 — Hero / primary */}
          <ShowcaseCard
            title="Nova hero"
            description="Wide gradient pillar with lift, colored shadow, and a sliding affordance cue."
          >
            <button
              type="button"
              className="group relative isolate inline-flex scale-105 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-linear-to-r from-sky-500 via-indigo-500 to-fuchsia-500 px-10 py-4 text-[15px] font-semibold text-white shadow-xl shadow-indigo-500/35 transition-[transform,box-shadow] hover:scale-[1.06] hover:shadow-2xl hover:shadow-indigo-500/40 active:scale-[1.02] sm:text-base"
            >
              <span className="absolute inset-y-[-40%] right-[-20%] w-1/2 rotate-12 bg-linear-to-br from-white/50 to-transparent opacity-40 blur-xl transition-opacity group-hover:opacity-70" />
              <Sparkles aria-hidden className="size-4.5" />
              <span className="relative">Start generating</span>
              <ArrowRight
                aria-hidden
                className="relative size-4 transition-transform duration-300 group-hover:translate-x-0.5"
              />
            </button>
          </ShowcaseCard>

          {/* 2 — Interior grain field (dark) */}
          <ShowcaseCard
            title="Obsidian field"
            description="Fractal noise layer plus four drifting glow masses and shimmering micro-specks—all clipped inside a quiet bezel."
          >
            <GrainFieldButton variant="obsidian">Reveal pricing</GrainFieldButton>
          </ShowcaseCard>

          {/* 3 — Interior grain field (frosted) */}
          <ShowcaseCard
            title="Cryo field"
            description="Same engine with cooler glass tint: brighter frost, aqua-violet blobs, plus-lighter sparks that wander the face."
          >
            <GrainFieldButton variant="cryo">Open workspace</GrainFieldButton>
          </ShowcaseCard>

          {/* 4 — Prism chaos */}
          <ShowcaseCard
            title="Prism chaos seed"
            description="Hydration-safe bootstrap, then a wild reroll — random HSL orbs/sparks, erratic Bézier or stepped spark timings, jittered fractal grain, and slow hue-roll drift."
          >
            <ChaosFieldButton kind="prism">Draw random batch</ChaosFieldButton>
          </ShowcaseCard>

          {/* 5 — Ember chaos */}
          <ShowcaseCard
            title="Ember chaos seed"
            description="Thermal palette roulette across apricots, coral, magenta, violet; heavier spark bursts with stepped easing; grain tile size and orbit cadence resampled on each mount."
          >
            <ChaosFieldButton kind="ember">Thermal fork</ChaosFieldButton>
          </ShowcaseCard>

          {/* 6 — Chrome / metallic */}
          <ShowcaseCard
            title="Lunar chrome"
            description="Specular metal rail with stacked highlights for a machined feel."
          >
            <button
              type="button"
              className="group hover:shadow-neutral-900/55 relative isolate inline-flex items-center rounded-lg bg-linear-to-b from-zinc-200 via-zinc-100 to-zinc-400 px-8 py-3.5 text-sm font-semibold text-zinc-900 shadow-[0_14px_0_rgba(9,9,11,0.92),inset_0_1px_0_rgba(255,255,255,0.9)] transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-[1.03] active:translate-y-0 active:brightness-95"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-6 top-[3px] h-2 rounded-full bg-white/85 opacity-80 blur-[1px]"
              />
              <span className="relative">Billing portal</span>
            </button>
          </ShowcaseCard>

          {/* 7 — Neon outline */}
          <ShowcaseCard
            title="Ion outline"
            description="Ink body with aqua stroke and drifting outer bloom."
          >
            <button
              type="button"
              className="rounded-xl bg-zinc-950 px-8 py-3.5 text-sm font-semibold text-sky-300 shadow-[0_0_0_1px_rgba(34,211,238,0.55),0_0_26px_-4px_rgba(34,211,238,0.55)] transition-[transform,box-shadow,color] hover:text-sky-200 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.8),0_0_42px_-2px_rgba(56,189,248,0.55)] hover:-translate-y-0.5 active:translate-y-0"
            >
              Connect API
            </button>
          </ShowcaseCard>

          {/* 8 — Elastic blob */}
          <ShowcaseCard
            title="Elastic dusk"
            description="Squash-ready pill with exaggerated motion curves."
          >
            <button
              type="button"
              className="inline-flex rounded-full bg-linear-to-br from-rose-500 via-orange-500 to-amber-400 px-8 py-3.5 text-sm font-bold text-black shadow-[0_12px_30px_-8px_rgba(249,115,22,0.65)] transition-transform duration-200 ease-[cubic-bezier(0.34,1.65,0.64,1)] hover:-translate-y-1 hover:scale-105 active:translate-y-0 active:scale-95"
            >
              Ship campaign
            </button>
          </ShowcaseCard>

          {/* 9 — Split */}
          <ShowcaseCard
            title="Vector split"
            description="Diagonal color break with asymmetric hover shear."
          >
            <button
              type="button"
              className="group border-border hover:border-muted-foreground/30 relative isolate inline-flex overflow-hidden rounded-xl border bg-zinc-950 transition-[transform,border-color] hover:-skew-x-1 hover:-translate-y-0.5 active:skew-x-0 active:translate-y-0"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-linear-to-br from-emerald-500/90 via-transparent to-transparent opacity-80 transition-opacity group-hover:opacity-95"
              />
              <span
                aria-hidden
                className="absolute inset-y-0 right-0 w-1/2 bg-linear-to-tl from-violet-600/95 via-transparent to-transparent opacity-95"
              />
              <span className="relative px-8 py-3.5 text-sm font-semibold text-white">
                Compare tiers
              </span>
            </button>
          </ShowcaseCard>

          {/* 10 — Aurora halo */}
          <ShowcaseCard
            title="Aurora bloom"
            description="Muted face with restless color flood behind masked edges."
          >
            <div className="relative inline-flex rounded-2xl p-[2px]">
              <span
                aria-hidden
                className="testing-animate-glow-blob absolute -inset-10 rounded-[2rem] bg-[conic-gradient(at_45%_40%,rgb(253,164,175),rgb(196,181,253),rgb(147,197,253),rgb(253,164,175))] blur-3xl saturate-125"
              />
              <span
                aria-hidden
                className="absolute inset-0 rounded-[0.9375rem] bg-[conic-gradient(from_210deg,rgb(251,207,232),rgb(186,230,253),rgb(196,181,253),rgb(253,214,219))]"
              />
              <button
                type="button"
                className="relative rounded-[calc(0.9375rem-2px)] bg-zinc-950/93 px-8 py-3.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[2px] transition-[transform,background-color] hover:bg-zinc-950/82 hover:-translate-y-px active:translate-y-0"
              >
                Calibrate preset
              </button>
            </div>
          </ShowcaseCard>
        </div>
      </div>
    </>
  )
}
