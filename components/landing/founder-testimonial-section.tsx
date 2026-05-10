"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useRef } from "react"
import { motion, useInView, useReducedMotion } from "motion/react"
const chartData = [
  { day: 1, label: "Day 1", views: 1500 },
  { day: 2, label: "Day 2", views: 4000 },
  { day: 3, label: "Day 3", views: 9000 },
  { day: 4, label: "Day 4", views: 18000 },
  { day: 5, label: "Day 5", views: 38000 },
  { day: 6, label: "Day 6", views: 132000 },
  { day: 7, label: "Day 7", views: 250000 },
] as const

const yAxisLabels = [0, 50000, 100000, 150000, 200000, 250000] as const

const svgWidth = 608
const svgHeight = 348
const padding = { top: 28, right: 26, bottom: 38, left: 54 }
const chartWidth = svgWidth - padding.left - padding.right
const chartHeight = svgHeight - padding.top - padding.bottom
const easeOut = [0.22, 1, 0.36, 1] as const

function formatViews(value: number) {
  if (value === 0) {
    return "0"
  }

  return `${Math.round(value / 1000)}k`
}

export function FounderTestimonialSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: "0px 0px -15% 0px" })
  const reduceMotion = useReducedMotion()
  const revealed = isInView || reduceMotion
  const shouldLoop = revealed && !reduceMotion

  const points = useMemo(() => {
    const maxDay = chartData[chartData.length - 1]?.day ?? 7
    const maxViews = yAxisLabels[yAxisLabels.length - 1] ?? 250000

    return chartData.map((point) => {
      const x = padding.left + (point.day / maxDay) * chartWidth
      const y = padding.top + chartHeight - (point.views / maxViews) * chartHeight
      return { ...point, x, y }
    })
  }, [])

  const hitVideoPoint = points.find((point) => point.day === 6)
  const breakoutPoint = points[points.length - 1]

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")

  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? svgWidth - padding.right} ${svgHeight - padding.bottom} L ${points[0]?.x ?? padding.left} ${svgHeight - padding.bottom} Z`

  return (
    <section ref={sectionRef} className="w-full bg-background py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-14 lg:px-8">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-2 py-1">
            <p className="text-sm font-medium lowercase leading-snug text-muted-foreground sm:text-base">
              founder testimonial
            </p>
            <Image
              src="/founder_photo/20260105_103146.jpg"
              alt="Founder"
              width={40}
              height={40}
              className="h-9 w-9 shrink-0 rounded-full border-2 border-border object-cover sm:h-10 sm:w-10"
            />
            <span className="text-base font-medium text-muted-foreground sm:text-lg" aria-hidden>
              .
            </span>
          </div>

          <h2 className="mt-5 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            I used UniCan agent for organic marketing and hit 250,000 views in 7 days.
          </h2>

          <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg">
            &quot;I always struggled to post content consistently, so I built UniCan to make organic
            marketing faster for me. I used UniCan agent automations to run two channels, stay
            consistent, and test ideas every day. One video hit, and together the channels reached
            250,000 organic views in 7 days.&quot;
          </p>

          <Link
            href="https://x.com/Simoncodingshit/status/2051864111655330245?s=20"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center text-sm font-medium text-primary underline underline-offset-4 transition-opacity hover:opacity-80"
          >
            See the proof on X
          </Link>
        </div>

        <motion.div
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 }}
          animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 }}
          transition={{ duration: 0.7, ease: easeOut }}
          className="relative overflow-visible rounded-[2rem] border border-border/60 bg-background/85 p-6 backdrop-blur-sm sm:p-7 lg:p-8 dark:bg-background/82 shadow-[0_4px_6px_-1px_rgba(59,130,246,0.06),0_32px_64px_-20px_rgba(15,23,42,0.18),0_12px_28px_-8px_rgba(15,23,42,0.12)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5),0_40px_80px_-24px_rgba(0,0,0,0.55)]"
        >
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-7">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Views growth
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">
                  250,000 total views
                </p>
              </div>
              <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Hit video on Day 6
              </div>
            </div>

            <div className="relative">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="h-auto w-full"
                role="img"
                aria-label="Looping line chart showing total views across two organic channels rising to 250,000 by day 7, with a hit video creating the inflection point on day 6"
              >
                {yAxisLabels.map((value) => {
                  const y = padding.top + chartHeight - (value / yAxisLabels[yAxisLabels.length - 1]) * chartHeight
                  return (
                    <g key={value}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={svgWidth - padding.right}
                        y2={y}
                        stroke="currentColor"
                        strokeOpacity="0.1"
                        strokeDasharray="4 6"
                      />
                      <text
                        x={padding.left - 12}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-muted-foreground text-[11px]"
                      >
                        {formatViews(value)}
                      </text>
                    </g>
                  )
                })}

                {points.map((point) => (
                  <text
                    key={point.label}
                    x={point.x}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[11px]"
                  >
                    {point.label}
                  </text>
                ))}

                <line
                  x1={padding.left}
                  y1={padding.top}
                  x2={padding.left}
                  y2={svgHeight - padding.bottom}
                  stroke="currentColor"
                  strokeOpacity="0.16"
                />
                <line
                  x1={padding.left}
                  y1={svgHeight - padding.bottom}
                  x2={svgWidth - padding.right}
                  y2={svgHeight - padding.bottom}
                  stroke="currentColor"
                  strokeOpacity="0.16"
                />

                <motion.path
                  d={areaPath}
                  fill="url(#founder-chart-fill)"
                  initial={reduceMotion ? { opacity: 0.95 } : { opacity: 0 }}
                  animate={
                    shouldLoop
                      ? { opacity: [0, 0.95, 0.95, 0] }
                      : revealed
                        ? { opacity: 0.95 }
                        : { opacity: 0 }
                  }
                  transition={
                    shouldLoop
                      ? { duration: 4.2, times: [0, 0.2, 0.78, 1], delay: 0.2, ease: "linear", repeat: Infinity, repeatDelay: 0.5 }
                      : { duration: 0.7, delay: 0.2, ease: easeOut }
                  }
                />

                <motion.path
                  d={linePath}
                  fill="none"
                  stroke="url(#founder-chart-stroke)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0.6 }}
                  animate={
                    shouldLoop
                      ? { pathLength: [0, 1, 1, 0], opacity: [0.6, 1, 1, 0.6] }
                      : revealed
                        ? { pathLength: 1, opacity: 1 }
                        : { pathLength: 0, opacity: 0.6 }
                  }
                  transition={
                    shouldLoop
                      ? { duration: 4.2, times: [0, 0.42, 0.78, 1], delay: 0.12, ease: "linear", repeat: Infinity, repeatDelay: 0.5 }
                      : { duration: 1.25, delay: 0.12, ease: easeOut }
                  }
                />

                {points.map((point, index) => (
                  <motion.g
                    key={`${point.day}-${point.views}`}
                    initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
                    animate={
                      shouldLoop
                        ? { opacity: [0, 1, 1, 0], scale: [0.7, 1, 1, 0.7] }
                        : revealed
                          ? { opacity: 1, scale: 1 }
                          : { opacity: 0, scale: 0.7 }
                    }
                    transition={
                      shouldLoop
                        ? {
                            duration: 4.2,
                            times: [0, 0.24, 0.78, 1],
                            delay: 0.3 + index * 0.1,
                            ease: "linear",
                            repeat: Infinity,
                            repeatDelay: 0.5,
                          }
                        : {
                            duration: 0.32,
                            delay: 0.3 + index * 0.1,
                            ease: easeOut,
                          }
                    }
                    style={{ transformOrigin: `${point.x}px ${point.y}px` }}
                  >
                    {point.day === 6 ? (
                      <motion.circle
                        cx={point.x}
                        cy={point.y}
                        r="16"
                        fill="var(--color-chart-4)"
                        fillOpacity="0.14"
                        initial={reduceMotion ? { opacity: 0.9, scale: 1 } : { opacity: 0, scale: 0.72 }}
                        animate={
                          shouldLoop
                            ? { opacity: [0.35, 0.12, 0.35], scale: [1, 1.28, 1] }
                            : revealed
                              ? { opacity: 0.9, scale: 1 }
                            : { opacity: 0, scale: 0.72 }
                        }
                        transition={
                          shouldLoop
                            ? { duration: 2.2, delay: 0.85, ease: "easeInOut", repeat: Infinity }
                            : { duration: 0.01 }
                        }
                      />
                    ) : null}
                    <circle cx={point.x} cy={point.y} r="8" fill="white" fillOpacity="0.88" />
                    <circle cx={point.x} cy={point.y} r="5" fill="currentColor" className="text-primary" />
                  </motion.g>
                ))}

                <defs>
                  <linearGradient id="founder-chart-stroke" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--color-chart-3)" />
                    <stop offset="100%" stopColor="var(--color-chart-4)" />
                  </linearGradient>
                  <linearGradient id="founder-chart-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-chart-4)" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="var(--color-chart-4)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
              </svg>

              {hitVideoPoint ? (
                <motion.div
                  initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                  animate={
                    shouldLoop
                      ? { opacity: [0, 1, 1, 0], y: [8, 0, 0, 8] }
                      : revealed
                        ? { opacity: 1, y: 0 }
                        : { opacity: 0, y: 8 }
                  }
                  transition={
                    shouldLoop
                      ? { duration: 4.2, times: [0, 0.3, 0.78, 1], delay: 0.72, ease: "linear", repeat: Infinity, repeatDelay: 0.5 }
                      : { duration: 0.38, delay: 0.72, ease: easeOut }
                  }
                  className="absolute left-[var(--inflection-left)] top-[var(--inflection-top)] z-10 -translate-x-1/2 -translate-y-[115%] sm:-translate-x-[38%]"
                  style={
                    {
                      "--inflection-left": `${(hitVideoPoint.x / svgWidth) * 100}%`,
                      "--inflection-top": `${(hitVideoPoint.y / svgHeight) * 100}%`,
                    } as React.CSSProperties
                  }
                >
                  <div className="rounded-2xl border border-primary/20 bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                      Inflection point
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">Hit video takes off</p>
                  </div>
                </motion.div>
              ) : null}

              {breakoutPoint ? (
                <motion.div
                  initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                  animate={
                    shouldLoop
                      ? { opacity: [0, 1, 1, 0], scale: [0.9, 1, 1, 0.9] }
                      : revealed
                        ? { opacity: 1, scale: 1 }
                        : { opacity: 0, scale: 0.9 }
                  }
                  transition={
                    shouldLoop
                      ? { duration: 4.2, times: [0, 0.34, 0.82, 1], delay: 0.92, ease: "linear", repeat: Infinity, repeatDelay: 0.5 }
                      : { duration: 0.42, delay: 0.92, ease: easeOut }
                  }
                  className="absolute z-10 max-sm:left-[var(--breakout-left)] max-sm:right-auto max-sm:top-[var(--breakout-top)] max-sm:-translate-x-1/2 max-sm:-translate-y-[115%] sm:left-auto sm:right-2 sm:top-4 sm:translate-x-0 sm:translate-y-0 rounded-2xl border border-primary/20 bg-background/95 px-3 py-2 text-center shadow-lg backdrop-blur sm:text-right"
                  style={
                    {
                      "--breakout-left": `${(breakoutPoint.x / svgWidth) * 100}%`,
                      "--breakout-top": `${(breakoutPoint.y / svgHeight) * 100}%`,
                    } as React.CSSProperties
                  }
                >
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                    Breakout point
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">250k</p>
                  <p className="text-xs text-muted-foreground">Total by day 7</p>
                </motion.div>
              ) : null}
            </div>
        </motion.div>
      </div>
    </section>
  )
}
