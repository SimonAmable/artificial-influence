"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { LayoutGroup, motion } from "framer-motion"
import {
  ArrowRight,
  Buildings,
  ChartBar,
  Code,
  Gear,
  PencilLine,
  Target,
  TreeStructure,
  User,
  Users,
  UsersThree,
  Globe,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { completeOnboarding } from "@/app/onboarding/actions"
import { setOnboardingCompletedLocal } from "@/lib/onboarding/client-storage"
import type {
  CompleteOnboardingPayload,
} from "@/lib/onboarding/payload-schema"
import { cn } from "@/lib/utils"

const STEPS = 4

const TEAM_OPTIONS: {
  id: CompleteOnboardingPayload["teamSize"]
  label: string
  icon: React.ReactNode
}[] = [
  { id: "solo", label: "Solo", icon: <User className="size-7" weight="duotone" /> },
  {
    id: "2-20",
    label: "2 – 20",
    icon: <UsersThree className="size-7" weight="duotone" />,
  },
  {
    id: "21-200",
    label: "21 – 200",
    icon: <Users className="size-7" weight="duotone" />,
  },
  {
    id: "200+",
    label: "200+",
    icon: <Globe className="size-7" weight="duotone" />,
  },
]

const ROLE_OPTIONS: {
  id: CompleteOnboardingPayload["role"]
  label: string
  icon: React.ReactNode
}[] = [
  { id: "founder", label: "Founder", icon: <Buildings className="size-5" /> },
  { id: "product", label: "Product", icon: <TreeStructure className="size-5" /> },
  { id: "designer", label: "Designer", icon: <PencilLine className="size-5" /> },
  { id: "engineer", label: "Engineer", icon: <Code className="size-5" /> },
  { id: "consultant", label: "Consultant", icon: <ChartBar className="size-5" /> },
  {
    id: "marketing_sales",
    label: "Marketing / Sales",
    icon: <Target className="size-5" />,
  },
  { id: "operations", label: "Operations", icon: <Gear className="size-5" /> },
  { id: "other", label: "Other", icon: <User className="size-5" /> },
]

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: STEPS }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full transition-all duration-300",
            i === step
              ? "h-2 w-8 bg-primary"
              : "h-2 w-2 bg-muted-foreground/35"
          )}
        />
      ))}
    </div>
  )
}

function ThemeMiniPreview({ variant }: { variant: "light" | "dark" }) {
  const isDark = variant === "dark"
  return (
    <div
      className={cn(
        "flex h-24 w-full gap-1 rounded-lg border p-1.5 shadow-inner",
        isDark
          ? "border-border bg-muted"
          : "border-border bg-card"
      )}
    >
      <div
        className={cn(
          "w-[28%] rounded-md",
          isDark ? "bg-muted-foreground/25" : "bg-muted"
        )}
      />
      <div className="flex flex-1 flex-col gap-1">
        <div
          className={cn(
            "h-2 rounded",
            isDark ? "bg-muted-foreground/20" : "bg-muted-foreground/15"
          )}
        />
        <div
          className={cn(
            "flex-1 rounded-md",
            isDark ? "bg-muted-foreground/15" : "bg-background"
          )}
        />
      </div>
    </div>
  )
}

/** Moving primary glow, shared layoutId per step so selection animates between options. */
function choiceGlowLayoutId(step: number) {
  return `onboarding-choice-glow-step-${step}`
}

export function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter()
  const { setTheme } = useTheme()
  const [step, setStep] = React.useState(0)
  const [pending, setPending] = React.useState(false)

  const [themeChoice, setThemeChoice] = React.useState<
    CompleteOnboardingPayload["theme"] | null
  >(null)
  const [fullName, setFullName] = React.useState("")
  const [teamSize, setTeamSize] = React.useState<
    CompleteOnboardingPayload["teamSize"] | null
  >(null)
  const [role, setRole] = React.useState<
    CompleteOnboardingPayload["role"] | null
  >(null)

  /** Preview: setTheme on click only. Saved theme in JSON is metrics-only. */
  const pickTheme = (t: CompleteOnboardingPayload["theme"]) => {
    setThemeChoice(t)
    setTheme(t)
  }

  const canGoNext = () => {
    if (step === 0) return themeChoice !== null
    if (step === 1) return fullName.trim().length >= 1
    if (step === 2) return teamSize !== null
    return false
  }

  const goNext = () => {
    if (!canGoNext()) return
    if (step < STEPS - 1) setStep((s) => s + 1)
  }

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1)
  }

  const onFinish = async () => {
    if (themeChoice === null || teamSize === null || role === null) {
      toast.error("Complete all steps")
      return
    }
    setPending(true)
    try {
      const result = await completeOnboarding({
        theme: themeChoice,
        fullName: fullName.trim(),
        teamSize,
        role,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setOnboardingCompletedLocal(userId)
      router.push("/dashboard")
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  const glowId = choiceGlowLayoutId(step)

  return (
    <div className="relative min-h-dvh w-full bg-background">
      <div className="flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-2xl flex-col items-center gap-6">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary p-2.5 shadow-sm">
            <Image
              src="/logo.svg"
              alt=""
              width={28}
              height={28}
              className="invert opacity-95"
            />
          </div>

          {step === 0 && (
            <>
              <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground">
                Pick your style
              </h1>
              <LayoutGroup id="onboarding-theme">
                <div className="grid w-full max-w-md grid-cols-2 gap-4">
                  {(["light", "dark"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => pickTheme(t)}
                      className={cn(
                        "relative overflow-hidden rounded-2xl border border-border bg-card/50 p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                    >
                      {themeChoice === t && (
                        <motion.div
                          layoutId={glowId}
                          className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/12 shadow-[0_0_28px_-2px] shadow-primary/50 ring-2 ring-primary/45"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 34,
                          }}
                        />
                      )}
                      <div className="relative z-10 flex flex-col gap-3">
                        <ThemeMiniPreview variant={t} />
                        <span className="text-center text-sm font-medium capitalize text-foreground">
                          {t === "light" ? "Light" : "Dark"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </LayoutGroup>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground">
                What&apos;s your name?
              </h1>
              <div className="w-full max-w-md space-y-2">
                <Label htmlFor="onboarding-name" className="text-foreground">
                  Full name
                </Label>
                <Input
                  id="onboarding-name"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="h-12 rounded-xl"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-[1.35rem]">
                How many people work at your company?
              </h1>
              <LayoutGroup id="onboarding-team">
                <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                  {TEAM_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTeamSize(opt.id)}
                      className="relative overflow-hidden rounded-2xl border border-border bg-card/50 px-2 py-4 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {teamSize === opt.id && (
                        <motion.div
                          layoutId={glowId}
                          className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/12 shadow-[0_0_28px_-2px] shadow-primary/50 ring-2 ring-primary/45"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 34,
                          }}
                        />
                      )}
                      <span className="relative z-10 flex flex-col items-center gap-3 text-foreground">
                        {opt.icon}
                        <span className="text-xs font-medium sm:text-sm">
                          {opt.label}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </LayoutGroup>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground">
                Which role fits you best?
              </h1>
              <LayoutGroup id="onboarding-role">
                <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRole(opt.id)}
                      className="relative overflow-hidden rounded-xl border border-border bg-card/50 px-2 py-3 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {role === opt.id && (
                        <motion.div
                          layoutId={glowId}
                          className="pointer-events-none absolute inset-0 rounded-xl bg-primary/12 shadow-[0_0_28px_-2px] shadow-primary/50 ring-2 ring-primary/45"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 34,
                          }}
                        />
                      )}
                      <span className="relative z-10 flex flex-col items-center gap-2 text-foreground">
                        {opt.icon}
                        <span className="text-xs leading-tight font-medium">
                          {opt.label}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </LayoutGroup>
            </>
          )}

          <div className="flex w-full max-w-md flex-col gap-4 pt-2">
            {step < STEPS - 1 ? (
              <Button
                type="button"
                size="lg"
                onClick={goNext}
                disabled={!canGoNext()}
                className="h-12 w-full rounded-full"
              >
                Next
                <ArrowRight className="size-4" weight="bold" data-icon="inline-end" />
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={onFinish}
                disabled={role === null || pending}
                className="h-12 w-full rounded-full"
              >
                {pending ? "Saving…" : "Finish"}
                <ArrowRight className="size-4" weight="bold" data-icon="inline-end" />
              </Button>
            )}

            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Back
              </button>
            )}
          </div>

          <ProgressDots step={step} />
        </div>
      </div>
    </div>
  )
}
