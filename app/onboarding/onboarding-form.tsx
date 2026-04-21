"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { LayoutGroup, motion } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  Briefcase,
  Buildings,
  ChartBar,
  Check,
  Code,
  Crown,
  CurrencyDollar,
  Diamond,
  DotsThree,
  FilmStrip,
  Gauge,
  Gear,
  Ghost,
  Globe,
  Hand,
  InstagramLogo,
  Lightning,
  MagicWand,
  MagnifyingGlass,
  Palette,
  PencilLine,
  ShareNetwork,
  ShoppingBag,
  Sliders,
  Stack,
  Target,
  TreeStructure,
  TwitterLogo,
  User,
  Users,
  UsersThree,
  VideoCamera,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { completeOnboarding } from "@/app/onboarding/actions"
import { OnboardingLearnScreen } from "@/app/onboarding/onboarding-learn-screen"
import { setOnboardingCompletedLocal } from "@/lib/onboarding/client-storage"
import type { OnboardingLearnAutomation } from "@/lib/onboarding/learn-automation"
import type { CompleteOnboardingPayload } from "@/lib/onboarding/payload-schema"
import { cn } from "@/lib/utils"

const STEPS = 9

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

const CREATION_GOAL_OPTIONS: {
  id: CompleteOnboardingPayload["creationGoals"][number]
  label: string
  description?: string
  icon: React.ReactNode
}[] = [
  {
    id: "ai_influencer_content",
    label: "AI Influencer Content",
    icon: <User className="size-6" weight="duotone" />,
  },
  {
    id: "motion_control_videos",
    label: "Motion Control Videos",
    icon: <FilmStrip className="size-6" weight="duotone" />,
  },
  {
    id: "product_ads",
    label: "Product Ads",
    icon: <ShoppingBag className="size-6" weight="duotone" />,
  },
  {
    id: "social_media",
    label: "Social Media",
    icon: <ShareNetwork className="size-6" weight="duotone" />,
  },
  {
    id: "artistic",
    label: "Artistic",
    icon: <Palette className="size-6" weight="duotone" />,
  },
  {
    id: "memes",
    label: "Memes",
    icon: <Ghost className="size-6" weight="duotone" />,
  },
  {
    id: "professional",
    label: "Professional",
    icon: <Briefcase className="size-6" weight="duotone" />,
  },
  {
    id: "other",
    label: "Other",
    icon: <DotsThree className="size-6" weight="bold" />,
  },
]

const AI_EXPERIENCE_OPTIONS: {
  id: CompleteOnboardingPayload["aiExperience"]
  label: string
  description: string
  icon: React.ReactNode
}[] = [
  {
    id: "beginner",
    label: "Beginner",
    description: "Just getting started",
    icon: <Baby className="size-6" weight="duotone" />,
  },
  {
    id: "intermediate",
    label: "Intermediate",
    description: "Used some AI tools",
    icon: <Stack className="size-6" weight="duotone" />,
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Regular AI user",
    icon: <Lightning className="size-6" weight="duotone" />,
  },
  {
    id: "expert",
    label: "Expert",
    description: "AI professional",
    icon: <Crown className="size-6" weight="duotone" />,
  },
]

const REFERRAL_OPTIONS: {
  id: CompleteOnboardingPayload["referralSource"]
  label: string
  icon: React.ReactNode
}[] = [
  { id: "tiktok", label: "TikTok", icon: <VideoCamera className="size-6" weight="duotone" /> },
  { id: "youtube", label: "YouTube", icon: <VideoCamera className="size-6" weight="duotone" /> },
  {
    id: "instagram",
    label: "Instagram",
    icon: <InstagramLogo className="size-6" weight="duotone" />,
  },
  { id: "twitter", label: "Twitter / X", icon: <TwitterLogo className="size-6" weight="duotone" /> },
  {
    id: "google",
    label: "Google Search",
    icon: <MagnifyingGlass className="size-6" weight="duotone" />,
  },
  {
    id: "friend",
    label: "Friend / Word of mouth",
    icon: <Users className="size-6" weight="duotone" />,
  },
  { id: "reddit", label: "Reddit", icon: <Globe className="size-6" weight="duotone" /> },
  { id: "other", label: "Other", icon: <DotsThree className="size-6" weight="bold" /> },
]

const PRIORITY_OPTIONS: {
  id: CompleteOnboardingPayload["priorities"][number]
  label: string
  icon: React.ReactNode
}[] = [
  {
    id: "video_quality",
    label: "Video quality",
    icon: <Diamond className="size-6" weight="duotone" />,
  },
  {
    id: "generation_speed",
    label: "Fast generation speed",
    icon: <Gauge className="size-6" weight="duotone" />,
  },
  {
    id: "ease_of_use",
    label: "Easy to use",
    icon: <Hand className="size-6" weight="duotone" />,
  },
  {
    id: "affordable_pricing",
    label: "Affordable pricing",
    icon: <CurrencyDollar className="size-6" weight="duotone" />,
  },
  {
    id: "creative_control",
    label: "Creative control",
    icon: <Sliders className="size-6" weight="duotone" />,
  },
  {
    id: "unique_models",
    label: "Unique AI models",
    icon: <MagicWand className="size-6" weight="duotone" />,
  },
]

function OnboardingProgressBar({ step }: { step: number }) {
  const displayStep = step + 1
  const pct = Math.round((displayStep / STEPS) * 100)
  return (
    <div className="w-full max-w-md space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Step {displayStep} of {STEPS}
        </span>
        <span>{pct}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ThemeMiniPreview({ variant }: { variant: "light" | "dark" }) {
  const isDark = variant === "dark"
  return (
    <div
      className={cn(
        "flex h-24 w-full gap-1 rounded-lg border p-1.5 shadow-inner",
        isDark ? "border-border bg-muted" : "border-border bg-card"
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

function choiceGlowLayoutId(step: number, suffix = "") {
  return `onboarding-choice-glow-step-${step}${suffix}`
}

type SelectableRowSingleProps = {
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  label: string
  description?: string
  layoutId: string
}

function SelectableRowSingle({
  selected,
  onSelect,
  icon,
  label,
  description,
  layoutId,
}: SelectableRowSingleProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card/50 px-4 py-3.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {selected && (
        <motion.div
          layoutId={layoutId}
          className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/12 shadow-[0_0_28px_-2px] shadow-primary/50 ring-2 ring-primary/45"
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 34,
          }}
        />
      )}
      <span
        className={cn(
          "relative z-10 shrink-0 text-foreground",
          selected ? "text-primary" : "text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="relative z-10 min-w-0 flex-1">
        <span
          className={cn(
            "block font-medium",
            selected ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      {selected ? (
        <Check
          className="relative z-10 size-5 shrink-0 text-primary"
          weight="bold"
        />
      ) : null}
    </button>
  )
}

type SelectableRowMultiProps = {
  selected: boolean
  onToggle: () => void
  icon: React.ReactNode
  label: string
  description?: string
}

function SelectableRowMulti({
  selected,
  onToggle,
  icon,
  label,
  description,
}: SelectableRowMultiProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-card/50 px-4 py-3.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary/45 ring-2 ring-primary/45"
          : "border-border"
      )}
    >
      <span
        className={cn(
          "shrink-0",
          selected ? "text-primary" : "text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block font-medium",
            selected ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      {selected ? (
        <Check className="size-5 shrink-0 text-primary" weight="bold" />
      ) : null}
    </button>
  )
}

export function OnboardingForm({
  userId,
  learnAutomation,
}: {
  userId: string
  learnAutomation: OnboardingLearnAutomation | null
}) {
  const router = useRouter()
  const { setTheme } = useTheme()
  const [step, setStep] = React.useState(0)
  const [pending, setPending] = React.useState(false)
  const [showLearnScreen, setShowLearnScreen] = React.useState(false)

  const [themeChoice, setThemeChoice] = React.useState<
    CompleteOnboardingPayload["theme"] | null
  >(null)
  const [creationGoals, setCreationGoals] = React.useState<
    CompleteOnboardingPayload["creationGoals"]
  >([])
  const [aiExperience, setAiExperience] = React.useState<
    CompleteOnboardingPayload["aiExperience"] | null
  >(null)
  const [fullName, setFullName] = React.useState("")
  const [referralSource, setReferralSource] = React.useState<
    CompleteOnboardingPayload["referralSource"] | null
  >(null)
  const [priorities, setPriorities] = React.useState<
    CompleteOnboardingPayload["priorities"]
  >([])
  const [teamSize, setTeamSize] = React.useState<
    CompleteOnboardingPayload["teamSize"] | null
  >(null)
  const [role, setRole] = React.useState<
    CompleteOnboardingPayload["role"] | null
  >(null)
  const [acceptedTerms, setAcceptedTerms] = React.useState(false)

  const pickTheme = (t: CompleteOnboardingPayload["theme"]) => {
    setThemeChoice(t)
    setTheme(t)
  }

  const toggleCreationGoal = (id: CompleteOnboardingPayload["creationGoals"][number]) => {
    setCreationGoals((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const togglePriority = (id: CompleteOnboardingPayload["priorities"][number]) => {
    setPriorities((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) {
        toast.message("Pick at most 3")
        return prev
      }
      return [...prev, id]
    })
  }

  const canGoNext = () => {
    if (step === 0) return true
    if (step === 1) return themeChoice !== null
    if (step === 2) return creationGoals.length >= 1
    if (step === 3) return aiExperience !== null
    if (step === 4) return fullName.trim().length >= 1
    if (step === 5) return referralSource !== null
    if (step === 6) return priorities.length >= 1 && priorities.length <= 3
    if (step === 7) return teamSize !== null && role !== null
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
    if (
      themeChoice === null ||
      creationGoals.length < 1 ||
      aiExperience === null ||
      referralSource === null ||
      priorities.length < 1 ||
      teamSize === null ||
      role === null ||
      !acceptedTerms
    ) {
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
        creationGoals,
        aiExperience,
        referralSource,
        priorities,
        acceptedTerms: true,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setOnboardingCompletedLocal(userId)
      if (learnAutomation) {
        setShowLearnScreen(true)
        return
      }
      router.push("/dashboard")
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  const leaveOnboarding = React.useCallback(() => {
    router.push("/dashboard")
    router.refresh()
  }, [router])

  const glowId = choiceGlowLayoutId(step)
  const glowTeam = choiceGlowLayoutId(step, "-team")
  const glowRole = choiceGlowLayoutId(step, "-role")

  const showBack = step > 0
  const isLastStep = step === STEPS - 1

  if (showLearnScreen && learnAutomation) {
    return (
      <OnboardingLearnScreen
        automation={learnAutomation}
        onSkip={leaveOnboarding}
        onContinue={leaveOnboarding}
      />
    )
  }

  return (
    <div className="relative min-h-dvh w-full bg-background">
      <div className="flex min-h-dvh w-full flex-col px-4 py-8">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
          <div className="flex flex-col items-center gap-4">
            <OnboardingProgressBar step={step} />
            {step !== 0 ? (
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary p-2.5 shadow-sm">
                <Image
                  src="/logo.svg"
                  alt=""
                  width={28}
                  height={28}
                  className="invert opacity-95"
                />
              </div>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center gap-6 overflow-y-auto">
            {step === 0 && (
              <div className="flex w-full max-w-md flex-col items-center gap-8 py-4 text-center">
                <div className="flex size-24 shrink-0 items-center justify-center rounded-full border-2 border-primary/50 bg-card/30 p-4 shadow-[0_0_32px_-4px] shadow-primary/25">
                  <Image
                    src="/logo.svg"
                    alt=""
                    width={48}
                    height={48}
                    className="invert opacity-95"
                  />
                </div>
                <div className="space-y-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    Welcome to UniCan
                  </h1>
                  <p className="text-foreground">
                    Let&apos;s set up your creative space
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Answer a few quick questions so we can personalize your
                    experience.
                  </p>
                </div>
              </div>
            )}

            {step === 1 && (
              <>
                <div className="w-full max-w-md space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    Pick your style
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Light or dark — you can change this anytime
                  </p>
                </div>
                <LayoutGroup id="onboarding-theme">
                  <div className="grid w-full max-w-md grid-cols-2 gap-4">
                    {(["light", "dark"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => pickTheme(t)}
                        className="relative overflow-hidden rounded-2xl border border-border bg-card/50 p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
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

            {step === 2 && (
              <>
                <div className="w-full max-w-md space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    What do you want to create?
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Select all that apply
                  </p>
                </div>
                <div className="flex w-full max-w-md flex-col gap-3">
                  {CREATION_GOAL_OPTIONS.map((opt) => (
                    <SelectableRowMulti
                      key={opt.id}
                      selected={creationGoals.includes(opt.id)}
                      onToggle={() => toggleCreationGoal(opt.id)}
                      icon={opt.icon}
                      label={opt.label}
                    />
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="w-full max-w-md space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    How experienced are you with AI tools?
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    This helps us personalize your experience
                  </p>
                </div>
                <LayoutGroup id="onboarding-ai-exp">
                  <div className="flex w-full max-w-md flex-col gap-3">
                    {AI_EXPERIENCE_OPTIONS.map((opt) => (
                      <SelectableRowSingle
                        key={opt.id}
                        selected={aiExperience === opt.id}
                        onSelect={() => setAiExperience(opt.id)}
                        icon={opt.icon}
                        label={opt.label}
                        description={opt.description}
                        layoutId={glowId}
                      />
                    ))}
                  </div>
                </LayoutGroup>
              </>
            )}

            {step === 4 && (
              <>
                <div className="w-full max-w-md space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    What&apos;s your name?
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    We&apos;ll use this in your workspace
                  </p>
                </div>
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

            {step === 5 && (
              <>
                <div className="w-full max-w-md space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    How did you hear about us?
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    We&apos;d love to know
                  </p>
                </div>
                <LayoutGroup id="onboarding-referral">
                  <div className="flex w-full max-w-md flex-col gap-3">
                    {REFERRAL_OPTIONS.map((opt) => (
                      <SelectableRowSingle
                        key={opt.id}
                        selected={referralSource === opt.id}
                        onSelect={() => setReferralSource(opt.id)}
                        icon={opt.icon}
                        label={opt.label}
                        layoutId={glowId}
                      />
                    ))}
                  </div>
                </LayoutGroup>
              </>
            )}

            {step === 6 && (
              <>
                <div className="w-full max-w-md space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    What matters most to you?
                  </h1>
                  <p className="text-sm text-muted-foreground">Pick up to 3</p>
                </div>
                <div className="flex w-full max-w-md flex-col gap-3">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectableRowMulti
                      key={opt.id}
                      selected={priorities.includes(opt.id)}
                      onToggle={() => togglePriority(opt.id)}
                      icon={opt.icon}
                      label={opt.label}
                    />
                  ))}
                </div>
              </>
            )}

            {step === 7 && (
              <>
                <div className="w-full max-w-md space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    Almost done
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Team size and your role
                  </p>
                </div>
                <div className="flex w-full max-w-2xl flex-col gap-8 pb-4">
                  <div className="space-y-3">
                    <h2 className="text-center text-sm font-medium text-foreground">
                      How many people work at your company?
                    </h2>
                    <LayoutGroup id="onboarding-team">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {TEAM_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setTeamSize(opt.id)}
                            className="relative overflow-hidden rounded-2xl border border-border bg-card/50 px-2 py-4 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {teamSize === opt.id && (
                              <motion.div
                                layoutId={glowTeam}
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
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-center text-sm font-medium text-foreground">
                      Which role fits you best?
                    </h2>
                    <LayoutGroup id="onboarding-role">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {ROLE_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setRole(opt.id)}
                            className="relative overflow-hidden rounded-xl border border-border bg-card/50 px-2 py-3 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {role === opt.id && (
                              <motion.div
                                layoutId={glowRole}
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
                  </div>
                </div>
              </>
            )}

            {step === 8 && (
              <>
                <div className="w-full max-w-md space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    Final step
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Review the Terms before entering the app
                  </p>
                </div>
                <div className="mx-auto flex w-full max-w-md flex-col gap-4 pb-4">
                  <div className="rounded-3xl border border-border bg-card/60 p-5 shadow-sm">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <h2 className="text-sm font-semibold text-foreground">
                          Before you enter UniCan
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          UniCan is for adults only. You are responsible for the
                          rights to anything you upload or publish, and for
                          reviewing AI outputs before using them commercially or
                          posting them to third-party platforms.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/80 bg-background/70 p-4 text-sm text-muted-foreground">
                        <p>
                          Please read the{" "}
                          <Link
                            href="/terms"
                            target="_blank"
                            className="font-medium text-foreground underline underline-offset-2"
                          >
                            Terms of Use
                          </Link>{" "}
                          and{" "}
                          <Link
                            href="/privacy"
                            target="_blank"
                            className="font-medium text-foreground underline underline-offset-2"
                          >
                            Privacy Policy
                          </Link>{" "}
                          before finishing onboarding.
                        </p>
                      </div>
                      <label
                        htmlFor="accept-terms"
                        className="flex items-start gap-3 rounded-2xl border border-border/80 bg-background/70 p-3 text-sm"
                      >
                        <Checkbox
                          id="accept-terms"
                          checked={acceptedTerms}
                          onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                          className="mt-0.5"
                        />
                        <span className="leading-6 text-muted-foreground">
                          I agree to the current{" "}
                          <Link
                            href="/terms"
                            target="_blank"
                            className="font-medium text-foreground underline underline-offset-2"
                          >
                            Terms of Use
                          </Link>{" "}
                          and acknowledge the{" "}
                          <Link
                            href="/privacy"
                            target="_blank"
                            className="font-medium text-foreground underline underline-offset-2"
                          >
                            Privacy Policy
                          </Link>
                          . I confirm that I am at least 18 years old.
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div
            className={cn(
              "mx-auto mt-auto flex w-full max-w-md gap-3 pt-4",
              showBack ? "flex-row" : "justify-center"
            )}
          >
            {showBack ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={goBack}
                className="h-12 shrink-0 rounded-full px-5"
              >
                <ArrowLeft className="size-4" weight="bold" />
                Back
              </Button>
            ) : null}
            {!isLastStep ? (
              <Button
                type="button"
                size="lg"
                onClick={goNext}
                disabled={!canGoNext()}
                className={cn(
                  "h-12 rounded-full",
                  showBack ? "min-w-0 flex-1" : "w-full sm:w-auto sm:min-w-[200px]"
                )}
              >
                Continue
                <ArrowRight
                  className="size-4"
                  weight="bold"
                  data-icon="inline-end"
                />
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={onFinish}
                disabled={!acceptedTerms || pending}
                className="h-12 min-w-0 flex-1 rounded-full"
              >
                {pending ? "Saving…" : "Finish"}
                <ArrowRight
                  className="size-4"
                  weight="bold"
                  data-icon="inline-end"
                />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
