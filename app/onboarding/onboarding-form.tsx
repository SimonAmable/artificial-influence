"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { LayoutGroup, motion } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  Buildings,
  ChartBar,
  Check,
  Circle,
  Code,
  Crown,
  CurrencyDollar,
  Diamond,
  DotsThree,
  Gauge,
  Gear,
  Globe,
  Hand,
  InstagramLogo,
  Lightning,
  LinkSimple,
  MagicWand,
  MagnifyingGlass,
  PencilLine,
  Plus,
  Sliders,
  Sparkle,
  Stack,
  Target,
  TreeStructure,
  TwitterLogo,
  UploadSimple,
  User,
  Users,
  UsersThree,
  VideoCamera,
  X,
} from "@phosphor-icons/react"
import { SiInstagram, SiTiktok } from "react-icons/si"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { completeOnboarding } from "@/app/onboarding/actions"
import {
  BrandKitEditor,
  type BrandKitEditorHandle,
} from "@/components/brand-kit/brand-kit-editor"
import { saveAsset } from "@/lib/assets/library"
import { buildBrandKitPostBodyFromAnalyzePayload } from "@/lib/brand-kit/onboarding-persist"
import type { BrandOnboardingClientPayload } from "@/lib/brand-kit/onboarding-schema"
import type { BrandKit } from "@/lib/brand-kit/types"
import { invalidateCommandCache } from "@/lib/commands/cache"
import { setOnboardingCompletedLocal } from "@/lib/onboarding/client-storage"
import { onboardingOAuthResumeStepKey } from "@/lib/onboarding/constants"
import {
  CREATION_GOAL_MEDIA,
  type CreationGoalMedia,
} from "@/lib/onboarding/creation-goal-media"
import type { CompleteOnboardingPayload } from "@/lib/onboarding/payload-schema"
import {
  FOUNDER_NOTE_BODY,
  FOUNDER_NOTE_PHOTO_SRC,
  FOUNDER_NOTE_TITLE,
} from "@/lib/onboarding/founder-note"
import {
  INFLUENCER_PRESETS,
  type InfluencerPreset,
} from "@/lib/onboarding/influencer-presets"
import { cn } from "@/lib/utils"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"

const SOCIAL_CONNECT_STEP = 7
const INFLUENCER_ONBOARDING_STEP = 8
const CHARACTER_ONBOARDING_STEP = 9

/** Shown in rotation while `/api/brand-kit/analyze-url` is in flight (matches brand kit dialog). */
const BRAND_ANALYSIS_STATUS_MESSAGES = [
  "Extracting logo candidates…",
  "Scanning colors & typography…",
  "Inferring tone and brand voice…",
  "Mapping values and audience…",
  "Finalizing your Business DNA draft…",
] as const

type BrandOnboardingPhase = "input" | "analyze" | "review"
const MAX_INFLUENCER_UPLOADS = 6
const INFLUENCER_UPLOAD_ACCEPT =
  "image/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"

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
}[] = [
  { id: "ugc_social", label: "UGC & Social" },
  { id: "ai_influencer", label: "AI Influencers" },
  { id: "product_ads", label: "Product Ads" },
  { id: "memes_brainrot", label: "Memes & Brainrot" },
  { id: "carousel_posts", label: "Carousel Posts" },
  { id: "fashion_lifestyle", label: "Fashion & Lifestyle" },
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

function OnboardingProgressBar({ step, totalSteps }: { step: number; totalSteps: number }) {
  const displayStep = step + 1
  const pct = Math.round((displayStep / totalSteps) * 100)
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Step {displayStep} of {totalSteps}
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
          className="pointer-events-none absolute inset-px rounded-[calc(theme(borderRadius.2xl)-1px)] bg-primary/12 shadow-[0_0_28px_-2px] shadow-primary/50 ring-1 ring-primary/45"
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
  compact?: boolean
}

type CreationGoalMediaTileProps = {
  label: string
  selected: boolean
  onToggle: () => void
  media: CreationGoalMedia
  className?: string
}

function CreationGoalMediaTile({
  label,
  selected,
  onToggle,
  media,
  className,
}: CreationGoalMediaTileProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [hovered, setHovered] = React.useState(false)
  const playActive = selected || hovered

  React.useEffect(() => {
    const el = videoRef.current
    if (!el || media.kind !== "video") return
    if (playActive) {
      const p = el.play()
      if (p !== undefined) void p.catch(() => {})
    } else {
      el.pause()
      try {
        el.currentTime = 0
      } catch {
        /* seek may fail before metadata */
      }
    }
  }, [playActive, media])

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false)
      }}
      className={cn(
        "group relative min-w-0 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <div
        className={cn(
          "relative aspect-9/16 w-full overflow-hidden rounded-2xl border bg-muted/40 shadow-sm transition",
          selected
            ? "border-primary ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
            : "border-border hover:border-primary/35"
        )}
      >
        {(() => {
          switch (media.kind) {
            case "video":
              return (
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  src={media.src}
                  poster={media.poster}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  controls={false}
                  disablePictureInPicture
                  disableRemotePlayback
                  onContextMenu={(e) => e.preventDefault()}
                />
              )
            case "image":
              return (
                <Image
                  src={media.src}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 33vw, 200px"
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              )
            default: {
              const _exhaustive: never = media
              return _exhaustive
            }
          }
        })()}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/30 to-transparent px-3 pb-2.5 pt-10">
          <span className="block truncate text-base font-semibold text-white sm:text-lg">
            {label}
          </span>
        </div>
        {selected ? (
          <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
            <Check className="size-3.5" weight="bold" aria-hidden />
          </span>
        ) : null}
      </div>
    </button>
  )
}

function SelectableRowMulti({
  selected,
  onToggle,
  icon,
  label,
  description,
  compact = false,
}: SelectableRowMultiProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative flex w-full items-center overflow-hidden rounded-2xl border bg-card/50 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "gap-2.5 px-4 py-3" : "gap-3 px-4 py-3.5",
        selected ? "border-primary/45" : "border-border"
      )}
    >
      {selected ? (
        <span className="pointer-events-none absolute inset-px rounded-[calc(theme(borderRadius.2xl)-1px)] bg-primary/12 shadow-[0_0_28px_-2px] shadow-primary/50 ring-1 ring-primary/45" />
      ) : null}
      <span
        className={cn(
          "relative z-10 shrink-0",
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
        <Check className="relative z-10 size-5 shrink-0 text-primary" weight="bold" />
      ) : null}
    </button>
  )
}

type InfluencerPhase = "pick" | "create" | "upload"
type InfluencerMode = "preset" | "upload" | "skip"

type InfluencerUploadItem = {
  localId: string
  file: File
  previewUrl: string
  isVideo: boolean
  status: "pending" | "uploading" | "uploaded" | "error"
  assetId?: string
  error?: string
}

type InfluencerPickCardProps = {
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  title: string
  description: string
  layoutId: string
}

function InfluencerPickCard({
  selected,
  onSelect,
  icon,
  title,
  description,
  layoutId,
}: InfluencerPickCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex w-full flex-col items-start gap-3 overflow-hidden rounded-2xl border border-border bg-card/50 px-5 py-5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
    >
      {selected ? (
        <motion.div
          layoutId={layoutId}
          className="pointer-events-none absolute inset-px rounded-[calc(theme(borderRadius.2xl)-1px)] bg-primary/12 shadow-[0_0_28px_-2px] shadow-primary/50 ring-1 ring-primary/45"
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
        />
      ) : null}
      <span
        className={cn(
          "relative z-10 flex size-12 items-center justify-center rounded-2xl border bg-background/60",
          selected
            ? "border-primary/40 text-primary"
            : "border-border text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="relative z-10 space-y-1">
        <span className="block text-base font-semibold text-foreground">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
      {selected ? (
        <span className="absolute right-3 top-3 z-10 flex size-6 items-center justify-center rounded-full bg-primary shadow">
          <Check className="size-3.5 text-primary-foreground" weight="bold" />
        </span>
      ) : null}
    </button>
  )
}

type InfluencerPresetCardProps = {
  preset: InfluencerPreset
  selected: boolean
  onSelect: () => void
  layoutId: string
}

function InfluencerPresetCard({
  preset,
  selected,
  onSelect,
  layoutId,
}: InfluencerPresetCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex w-full overflow-hidden rounded-2xl border outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary/60" : "border-border"
      )}
      style={{ aspectRatio: "3 / 4" }}
    >
      {preset.thumbnailUrl ? (
        <Image
          src={preset.thumbnailUrl}
          alt={preset.name}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, 220px"
        />
      ) : (
        <div
          className={cn(
            "absolute inset-0 bg-linear-to-br",
            preset.gradientClassName ?? "from-muted via-muted to-muted-foreground/20"
          )}
        />
      )}

      {selected ? (
        <motion.div
          layoutId={layoutId}
          className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/20 ring-2 ring-primary/60"
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
        />
      ) : null}

      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/30 to-transparent px-3 pb-2.5 pt-10">
        <p className="truncate text-base font-semibold text-white">{preset.name}</p>
        <p className="mt-0.5 text-xs leading-snug text-white/75">{preset.description}</p>
      </div>

      {selected ? (
        <span className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full bg-primary shadow">
          <Check className="size-3.5 text-primary-foreground" weight="bold" />
        </span>
      ) : null}
    </button>
  )
}

type InfluencerUploadTileProps = {
  item: InfluencerUploadItem
  onRemove: () => void
  disabled?: boolean
}

function InfluencerUploadTile({ item, onRemove, disabled }: InfluencerUploadTileProps) {
  return (
    <div
      className={cn(
        "group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border bg-muted/40",
        item.status === "error" ? "border-destructive/60" : "border-border"
      )}
    >
      {item.isVideo ? (
        <video
          src={item.previewUrl}
          muted
          playsInline
          loop
          autoPlay
          className="h-full w-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
      )}

      {item.status === "uploading" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
          Uploading…
        </div>
      ) : null}

      {item.status === "uploaded" ? (
        <div className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
          <Check className="size-3" weight="bold" />
        </div>
      ) : null}

      {item.status === "error" ? (
        <div className="absolute inset-x-0 bottom-0 bg-destructive/80 px-2 py-1 text-center text-[10px] font-medium text-white">
          {item.error ?? "Upload failed"}
        </div>
      ) : null}

      {!disabled && item.status !== "uploading" ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove file"
          className="absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow transition group-hover:opacity-100"
        >
          <X className="size-3" weight="bold" />
        </button>
      ) : null}
    </div>
  )
}

export function OnboardingForm({
  userId,
  initialPrefill = null,
}: {
  userId: string
  initialPrefill?: Partial<CompleteOnboardingPayload> | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resolvedTheme, setTheme } = useTheme()
  const [step, setStep] = React.useState(0)
  const [pending, setPending] = React.useState(false)

  const [creationGoals, setCreationGoals] = React.useState<
    CompleteOnboardingPayload["creationGoals"]
  >(() => initialPrefill?.creationGoals ?? [])
  const [aiExperience, setAiExperience] = React.useState<
    CompleteOnboardingPayload["aiExperience"] | null
  >(() => initialPrefill?.aiExperience ?? null)
  const [fullName, setFullName] = React.useState(() => initialPrefill?.fullName ?? "")
  const [referralSource, setReferralSource] = React.useState<
    CompleteOnboardingPayload["referralSource"] | null
  >(() => initialPrefill?.referralSource ?? null)
  const [priorities, setPriorities] = React.useState<
    CompleteOnboardingPayload["priorities"]
  >(() => initialPrefill?.priorities ?? [])
  const [teamSize, setTeamSize] = React.useState<
    CompleteOnboardingPayload["teamSize"] | null
  >(() => initialPrefill?.teamSize ?? null)
  const [role, setRole] = React.useState<
    CompleteOnboardingPayload["role"] | null
  >(() => initialPrefill?.role ?? null)
  const [acceptedTerms, setAcceptedTerms] = React.useState(false)

  const [brandPhase, setBrandPhase] = React.useState<BrandOnboardingPhase>("input")
  const [brandUrl, setBrandUrl] = React.useState("")
  const [brandBusy, setBrandBusy] = React.useState(false)
  const [brandActiveUrl, setBrandActiveUrl] = React.useState<string | null>(null)
  const [brandAnalysisIndex, setBrandAnalysisIndex] = React.useState(0)
  const [brandPendingKitId, setBrandPendingKitId] = React.useState<string | null>(null)
  const [brandReviewSaving, setBrandReviewSaving] = React.useState(false)
  const brandEditorRef = React.useRef<BrandKitEditorHandle>(null)
  const prevStepForBrandRef = React.useRef(step)

  React.useEffect(() => {
    if (initialPrefill?.theme === "dark" || initialPrefill?.theme === "light") {
      setTheme(initialPrefill.theme)
    }
  }, [initialPrefill?.theme, setTheme])

  const wantsCharacter = creationGoals.includes("ai_influencer")
  const brandStepIndex = wantsCharacter ? 10 : 8
  const founderStepIndex = brandStepIndex + 1
  const termsStepIndex = founderStepIndex + 1
  const totalSteps = termsStepIndex + 1

  const [characterDialogInitial, setCharacterDialogInitial] = React.useState<
    React.ComponentProps<typeof CreateAssetDialog>["initial"] | null
  >(null)
  const [characterDialogOpen, setCharacterDialogOpen] = React.useState(false)
  const [characterDialogKey, setCharacterDialogKey] = React.useState(0)
  const [characterUploadBusy, setCharacterUploadBusy] = React.useState(false)
  const [characterAssetSaved, setCharacterAssetSaved] = React.useState(false)
  const [characterOnboardingSkipped, setCharacterOnboardingSkipped] = React.useState(false)
  const characterFileInputRef = React.useRef<HTMLInputElement>(null)

  const [influencerPhase, setInfluencerPhase] = React.useState<InfluencerPhase>("pick")
  const [influencerMode, setInfluencerMode] = React.useState<InfluencerMode | null>(
    () => initialPrefill?.aiInfluencer?.mode ?? null
  )
  const [influencerPresetId, setInfluencerPresetId] = React.useState<string | null>(
    () => initialPrefill?.aiInfluencer?.presetId ?? null
  )
  const [influencerUploads, setInfluencerUploads] = React.useState<InfluencerUploadItem[]>([])
  const [influencerBusy, setInfluencerBusy] = React.useState(false)
  const influencerFileInputRef = React.useRef<HTMLInputElement>(null)
  const influencerDragCounter = React.useRef(0)
  const [influencerDragging, setInfluencerDragging] = React.useState(false)

  type OnboardingSocialRow = {
    id: string
    provider: "instagram" | "tiktok"
    label: string
    status: string
  }

  const [socialConnectRows, setSocialConnectRows] = React.useState<OnboardingSocialRow[]>([])
  const lastHandledOauthSig = React.useRef<string>("")

  const loadSocialConnectStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/social-connections/status", { credentials: "same-origin" })
      if (!res.ok) {
        setSocialConnectRows([])
        return
      }
      const data = (await res.json()) as {
        providers?: {
          instagram?: {
            connections?: Array<{
              id: string
              username?: string | null
              display_name?: string | null
              status: string
            }>
          }
          tiktok?: {
            connections?: Array<{
              id: string
              username?: string | null
              display_name?: string | null
              status: string
            }>
          }
        }
        instagram?: {
          connections?: Array<{
            id: string
            username?: string | null
            display_name?: string | null
            status: string
          }>
        }
        tiktok?: {
          connections?: Array<{
            id: string
            username?: string | null
            display_name?: string | null
            status: string
          }>
        }
      }
      const ig =
        data.providers?.instagram?.connections ?? data.instagram?.connections ?? []
      const tt = data.providers?.tiktok?.connections ?? data.tiktok?.connections ?? []
      const next: OnboardingSocialRow[] = []
      for (const c of ig) {
        if (c.status !== "connected") continue
        next.push({
          id: c.id,
          provider: "instagram",
          label: c.username ? `@${c.username}` : c.display_name?.trim() || "Instagram",
          status: c.status,
        })
      }
      for (const c of tt) {
        if (c.status !== "connected") continue
        const label =
          (c.display_name ?? c.username)?.trim() ||
          (c.username ? `@${c.username}` : "TikTok")
        next.push({
          id: c.id,
          provider: "tiktok",
          label,
          status: c.status,
        })
      }
      setSocialConnectRows(next)
    } catch {
      setSocialConnectRows([])
    }
  }, [])

  const prevOnboardingStepRef = React.useRef(step)

  React.useEffect(() => {
    const prev = prevStepForBrandRef.current
    if (
      step === brandStepIndex &&
      prev === (wantsCharacter ? CHARACTER_ONBOARDING_STEP : SOCIAL_CONNECT_STEP)
    ) {
      setBrandPhase("input")
      setBrandUrl("")
      setBrandBusy(false)
      setBrandActiveUrl(null)
      setBrandPendingKitId(null)
      setBrandAnalysisIndex(0)
    }
    prevStepForBrandRef.current = step
  }, [step, brandStepIndex, wantsCharacter])

  React.useEffect(() => {
    if (!brandBusy) {
      setBrandAnalysisIndex(0)
      return
    }
    const id = window.setInterval(() => {
      setBrandAnalysisIndex((i) => (i + 1) % BRAND_ANALYSIS_STATUS_MESSAGES.length)
    }, 2400)
    return () => window.clearInterval(id)
  }, [brandBusy])

  React.useEffect(() => {
    if (step !== SOCIAL_CONNECT_STEP) return
    void loadSocialConnectStatus()
  }, [step, loadSocialConnectStatus])

  React.useEffect(() => {
    const error = searchParams.get("error")
    const connected = searchParams.get("connected")
    const provider = searchParams.get("provider")
    if (!error && connected !== "1") return

    const sig = `${error ?? ""}\u0000${connected ?? ""}\u0000${provider ?? ""}`
    if (lastHandledOauthSig.current === sig) return
    lastHandledOauthSig.current = sig

    try {
      const raw = sessionStorage.getItem(onboardingOAuthResumeStepKey(userId))
      if (raw !== null && raw !== "") {
        const n = Number.parseInt(raw, 10)
        if (Number.isFinite(n) && n >= 0 && n <= termsStepIndex) {
          setStep(n)
        }
        sessionStorage.removeItem(onboardingOAuthResumeStepKey(userId))
      }
    } catch {
      /* noop */
    }

    void loadSocialConnectStatus().then(() => {
      if (error) {
        const msg =
          provider === "tiktok"
            ? `TikTok: ${error}`
            : error.length > 160
              ? `${error.slice(0, 157)}…`
              : error
        toast.error(msg)
      } else {
        toast.success(
          provider === "tiktok" ? "TikTok account connected." : "Instagram account connected."
        )
      }
    })

    const url = new URL(window.location.href)
    url.searchParams.delete("error")
    url.searchParams.delete("connected")
    url.searchParams.delete("provider")
    const qs = url.searchParams.toString()
    router.replace(`${url.pathname}${qs ? `?${qs}` : ""}`)
  }, [searchParams, userId, router, loadSocialConnectStatus, termsStepIndex])

  React.useEffect(() => {
    if (!wantsCharacter) {
      setInfluencerUploads((prev) => {
        for (const u of prev) {
          try {
            URL.revokeObjectURL(u.previewUrl)
          } catch {
            /* noop */
          }
        }
        return []
      })
      setCharacterDialogInitial(null)
      setCharacterDialogOpen(false)
      setCharacterAssetSaved(false)
      setCharacterOnboardingSkipped(false)
      setCharacterUploadBusy(false)
      setInfluencerPhase("pick")
      setInfluencerMode(null)
      setInfluencerPresetId(null)
      setInfluencerBusy(false)
      setStep((s) => (s > termsStepIndex ? termsStepIndex : s))
    }
  }, [wantsCharacter, termsStepIndex])

  React.useEffect(() => {
    if (!wantsCharacter) return
    const prev = prevOnboardingStepRef.current
    if (step === INFLUENCER_ONBOARDING_STEP && prev === SOCIAL_CONNECT_STEP) {
      const prefillMode = initialPrefill?.aiInfluencer?.mode ?? null
      const prefillPreset = initialPrefill?.aiInfluencer?.presetId ?? null
      setInfluencerPhase(
        prefillMode === "preset" ? "create" : prefillMode === "upload" ? "upload" : "pick"
      )
      setInfluencerMode(prefillMode)
      setInfluencerPresetId(prefillPreset)
      setInfluencerBusy(false)
    }
    if (step === CHARACTER_ONBOARDING_STEP && prev === INFLUENCER_ONBOARDING_STEP) {
      setCharacterDialogInitial(null)
      setCharacterDialogOpen(false)
      setCharacterAssetSaved(false)
      setCharacterOnboardingSkipped(false)
      setCharacterUploadBusy(false)
    }
    prevOnboardingStepRef.current = step
  }, [step, wantsCharacter, initialPrefill?.aiInfluencer?.mode, initialPrefill?.aiInfluencer?.presetId])

  React.useEffect(() => {
    return () => {
      for (const item of influencerUploads) {
        try {
          URL.revokeObjectURL(item.previewUrl)
        } catch {
          /* noop */
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const presignOnboardingSocialOAuthReturn = () => {
    try {
      sessionStorage.setItem(onboardingOAuthResumeStepKey(userId), String(SOCIAL_CONNECT_STEP))
    } catch {
      /* noop */
    }
  }

  const startOnboardingInstagramConnect = () => {
    presignOnboardingSocialOAuthReturn()
    window.location.href = "/api/instagram/connect?next=/onboarding"
  }

  const startOnboardingTikTokConnect = () => {
    presignOnboardingSocialOAuthReturn()
    window.location.href = "/api/tiktok/connect?next=/onboarding"
  }

  const socialConnectSkip = () => {
    setStep(wantsCharacter ? INFLUENCER_ONBOARDING_STEP : brandStepIndex)
  }

  const deletePendingBrandKit = React.useCallback(async () => {
    if (!brandPendingKitId) return
    try {
      const res = await fetch(`/api/brand-kits/${brandPendingKitId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        invalidateCommandCache()
      }
    } catch {
      /* best-effort */
    } finally {
      setBrandPendingKitId(null)
    }
  }, [brandPendingKitId])

  const brandSkipToFounder = () => {
    setStep(founderStepIndex)
  }

  const brandSubmitUrl = async () => {
    const trimmed = brandUrl.trim()
    if (!trimmed) {
      toast.error("Enter a URL")
      return
    }
    setBrandBusy(true)
    setBrandPhase("analyze")
    setBrandActiveUrl(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    try {
      const res = await fetch("/api/brand-kit/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Analysis failed")
      }
      const payload = data as BrandOnboardingClientPayload
      const body = buildBrandKitPostBodyFromAnalyzePayload(payload)
      const resKit = await fetch("/api/brand-kits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const kitJson = (await resKit.json().catch(() => ({}))) as {
        error?: string
        kit?: BrandKit
      }
      if (!resKit.ok) {
        throw new Error(typeof kitJson.error === "string" ? kitJson.error : "Could not save brand")
      }
      if (!kitJson.kit?.id) throw new Error("Could not save brand")
      invalidateCommandCache()
      setBrandPendingKitId(kitJson.kit.id)
      setBrandPhase("review")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Could not analyze URL")
      setBrandPhase("input")
    } finally {
      setBrandBusy(false)
      setBrandActiveUrl(null)
    }
  }

  const brandReviewContinue = async () => {
    setBrandReviewSaving(true)
    try {
      const ok = (await brandEditorRef.current?.save()) ?? false
      if (ok) {
        setStep(founderStepIndex)
      }
    } finally {
      setBrandReviewSaving(false)
    }
  }

  const brandBackFromReview = async () => {
    await deletePendingBrandKit()
    setBrandPhase("input")
  }

  const brandDisplayUrl =
    brandBusy && brandActiveUrl
      ? brandActiveUrl
      : brandUrl.trim()
        ? /^https?:\/\//i.test(brandUrl.trim())
          ? brandUrl.trim()
          : `https://${brandUrl.trim()}`
        : "https://…"

  const removeInfluencerUpload = React.useCallback((localId: string) => {
    setInfluencerUploads((prev) => {
      const removed = prev.find((u) => u.localId === localId)
      if (removed) {
        try {
          URL.revokeObjectURL(removed.previewUrl)
        } catch {
          /* noop */
        }
      }
      return prev.filter((u) => u.localId !== localId)
    })
  }, [])

  const addInfluencerFiles = React.useCallback((files: FileList | File[] | null | undefined) => {
    if (!files) return
    const incoming = Array.from(files)
    if (incoming.length === 0) return
    setInfluencerUploads((prev) => {
      const remaining = Math.max(0, MAX_INFLUENCER_UPLOADS - prev.length)
      if (remaining <= 0) {
        toast.error(`Max ${MAX_INFLUENCER_UPLOADS} reference files`)
        return prev
      }
      const accepted: InfluencerUploadItem[] = []
      for (const file of incoming.slice(0, remaining)) {
        const isImage = file.type.startsWith("image/")
        const isVideo = file.type.startsWith("video/")
        if (!isImage && !isVideo) continue
        accepted.push({
          localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          isVideo,
          status: "pending",
        })
      }
      if (accepted.length === 0) {
        toast.error("Only images and short videos are supported")
        return prev
      }
      return [...prev, ...accepted]
    })
  }, [])

  const handleInfluencerFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addInfluencerFiles(e.target.files)
    e.target.value = ""
  }

  const handleInfluencerDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    influencerDragCounter.current = 0
    setInfluencerDragging(false)
    addInfluencerFiles(e.dataTransfer.files)
  }

  const handleInfluencerDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleInfluencerDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    influencerDragCounter.current += 1
    if (e.dataTransfer.types.includes("Files")) {
      setInfluencerDragging(true)
    }
  }

  const handleInfluencerDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    influencerDragCounter.current -= 1
    if (influencerDragCounter.current <= 0) {
      influencerDragCounter.current = 0
      setInfluencerDragging(false)
    }
  }

  const influencerSelectPreset = (id: string) => {
    setInfluencerPresetId(id)
  }

  const influencerOpenCreate = () => {
    setInfluencerMode("preset")
    setInfluencerPhase("create")
  }

  const influencerOpenUpload = () => {
    setInfluencerMode("upload")
    setInfluencerPhase("upload")
  }

  /** From the pick hub: advance without choosing preset or reference uploads (payload uses `mode: "skip"`). */
  const influencerContinueFromPick = () => {
    setInfluencerMode("skip")
    setInfluencerPresetId(null)
    setInfluencerPhase("pick")
    setCharacterOnboardingSkipped(false)
    setStep(CHARACTER_ONBOARDING_STEP)
  }

  /** Skip preset/reference uploads and the character step — continue at founder note. */
  const influencerSkipPastCharacter = () => {
    setInfluencerMode("skip")
    setInfluencerPresetId(null)
    setInfluencerPhase("pick")
    setCharacterOnboardingSkipped(true)
    setStep(brandStepIndex)
  }

  const characterSkipToFounder = () => {
    if (characterUploadBusy) return
    setCharacterOnboardingSkipped(true)
    setStep(brandStepIndex)
  }

  const influencerContinueFromCreate = () => {
    if (!influencerPresetId) {
      toast.error("Pick a preset character")
      return
    }
    setInfluencerMode("preset")
    setStep(CHARACTER_ONBOARDING_STEP)
  }

  const influencerContinueFromUpload = async () => {
    const pending = influencerUploads.filter((u) => u.status !== "uploaded")
    if (influencerUploads.length === 0) {
      toast.error("Add at least one reference file")
      return
    }
    setInfluencerBusy(true)
    try {
      const next: InfluencerUploadItem[] = [...influencerUploads]
      for (const item of pending) {
        const idx = next.findIndex((u) => u.localId === item.localId)
        if (idx === -1) continue
        next[idx] = { ...next[idx], status: "uploading", error: undefined }
        setInfluencerUploads([...next])
        try {
          const uploaded = await uploadFileToSupabase(item.file, "onboarding-influencer")
          if (!uploaded) {
            next[idx] = { ...next[idx], status: "error", error: "Upload failed" }
            setInfluencerUploads([...next])
            continue
          }
          const asset = await saveAsset({
            title: item.file.name || "Influencer reference",
            assetType: uploaded.fileType === "video" ? "video" : "image",
            category: "character",
            visibility: "private",
            tags: ["influencer", "onboarding"],
            url: uploaded.url,
            uploadId: uploaded.uploadId,
            supabaseStoragePath: uploaded.storagePath,
          })
          next[idx] = {
            ...next[idx],
            status: "uploaded",
            assetId: asset.id,
            error: undefined,
          }
          setInfluencerUploads([...next])
        } catch (e) {
          console.error(e)
          next[idx] = {
            ...next[idx],
            status: "error",
            error: e instanceof Error ? e.message : "Upload failed",
          }
          setInfluencerUploads([...next])
        }
      }
      const okIds = next
        .filter((u) => u.status === "uploaded" && u.assetId)
        .map((u) => u.assetId as string)
      if (okIds.length === 0) {
        toast.error("None of the files could be uploaded")
        return
      }
      setInfluencerMode("upload")
      setStep(CHARACTER_ONBOARDING_STEP)
    } finally {
      setInfluencerBusy(false)
    }
  }

  const canGoNext = () => {
    if (step === 0) return true
    if (step === 1) return creationGoals.length >= 1
    if (step === 2) return aiExperience !== null
    if (step === 3) return fullName.trim().length >= 1
    if (step === 4) return referralSource !== null
    if (step === 5) return priorities.length >= 1 && priorities.length <= 3
    if (step === 6) return teamSize !== null && role !== null
    if (step === SOCIAL_CONNECT_STEP) return true
    if (step === brandStepIndex) return false
    if (wantsCharacter && step === INFLUENCER_ONBOARDING_STEP) return false
    if (wantsCharacter && step === CHARACTER_ONBOARDING_STEP) return characterAssetSaved
    if (step === founderStepIndex) return true
    return false
  }

  const goNext = () => {
    if (!canGoNext()) return
    if (step < termsStepIndex) setStep((s) => s + 1)
  }

  const goBack = () => {
    if (step === brandStepIndex) {
      if (brandPhase === "input") {
        setStep(wantsCharacter ? CHARACTER_ONBOARDING_STEP : SOCIAL_CONNECT_STEP)
        return
      }
      if (brandPhase === "analyze") {
        return
      }
      if (brandPhase === "review") {
        void brandBackFromReview()
        return
      }
    }
    if (wantsCharacter && step === INFLUENCER_ONBOARDING_STEP) {
      if (influencerBusy) return
      const phase = influencerPhase
      if (phase === "pick") {
        setStep(SOCIAL_CONNECT_STEP)
        return
      }
      setInfluencerPhase("pick")
      setInfluencerMode(null)
      if (phase === "create") {
        setInfluencerPresetId(null)
      }
      return
    }
    if (step > 0) {
      setStep((s) => s - 1)
    }
  }

  const onFinish = async () => {
    if (
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
    if (wantsCharacter && !characterAssetSaved && !characterOnboardingSkipped) {
      toast.error("Save your character to the library before finishing.")
      return
    }
    const theme: CompleteOnboardingPayload["theme"] =
      resolvedTheme === "dark" ? "dark" : "light"
    const uploadedInfluencerAssetIds = influencerUploads
      .filter((u) => u.status === "uploaded" && u.assetId)
      .map((u) => u.assetId as string)
    const aiInfluencerPayload: { aiInfluencer: CompleteOnboardingPayload["aiInfluencer"] } | object =
      wantsCharacter
        ? {
            aiInfluencer:
              influencerMode === "preset" && influencerPresetId
                ? { mode: "preset", presetId: influencerPresetId }
                : influencerMode === "upload" && uploadedInfluencerAssetIds.length > 0
                  ? { mode: "upload", assetIds: uploadedInfluencerAssetIds }
                  : { mode: "skip" },
          }
        : {}
    const characterOnboardingPayload:
      | { characterOnboarding: NonNullable<CompleteOnboardingPayload["characterOnboarding"]> }
      | object =
      wantsCharacter
        ? characterAssetSaved
          ? { characterOnboarding: "saved" }
          : characterOnboardingSkipped
            ? { characterOnboarding: "skipped" }
            : {}
        : {}
    setPending(true)
    try {
      const result = await completeOnboarding({
        theme,
        fullName: fullName.trim(),
        teamSize,
        role,
        creationGoals,
        aiExperience,
        referralSource,
        priorities,
        ...aiInfluencerPayload,
        ...characterOnboardingPayload,
        acceptedTerms: true,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setOnboardingCompletedLocal(userId)
      router.push("/chat?onboarding=1")
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  const glowId = choiceGlowLayoutId(step)
  const glowTeam = choiceGlowLayoutId(step, "-team")
  const glowRole = choiceGlowLayoutId(step, "-role")

  const showBack =
    step > 0 &&
    !(wantsCharacter && step === INFLUENCER_ONBOARDING_STEP && influencerBusy) &&
    !(step === brandStepIndex && brandPhase === "analyze")
  const isLastStep = step === termsStepIndex
  const isSocialConnectStep = step === SOCIAL_CONNECT_STEP
  const isInfluencerStep = wantsCharacter && step === INFLUENCER_ONBOARDING_STEP
  const isCharacterStep = wantsCharacter && step === CHARACTER_ONBOARDING_STEP
  const isBrandStep = step === brandStepIndex
  const showContinueButton =
    !isSocialConnectStep &&
    !isInfluencerStep &&
    (!isCharacterStep || characterAssetSaved) &&
    !isBrandStep

  const handleCharacterFile = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a single PNG or JPG image.")
      return
    }
    setCharacterUploadBusy(true)
    setCharacterAssetSaved(false)
    setCharacterOnboardingSkipped(false)
    try {
      const result = await uploadFileToSupabase(file, "asset-library")
      if (!result || result.fileType !== "image") {
        if (result?.fileType && result.fileType !== "image") {
          toast.error("Only image files are supported for this step.")
        }
        return
      }
      setCharacterDialogInitial({
        url: result.url,
        assetType: "image",
        title: result.fileName,
        uploadId: result.uploadId,
        supabaseStoragePath: result.storagePath,
        category: "character",
      })
      setCharacterDialogKey((k) => k + 1)
      setCharacterDialogOpen(true)
    } finally {
      setCharacterUploadBusy(false)
    }
  }

  const handleCharacterAssetSaved = () => {
    setCharacterAssetSaved(true)
    setCharacterOnboardingSkipped(false)
    setCharacterDialogOpen(false)
    setStep(brandStepIndex)
  }

  return (
    <div className="relative min-h-dvh w-full bg-background">
      <div className="flex min-h-dvh w-full flex-col px-4 pb-28 pt-8">
        <div
          className={cn(
            "mx-auto flex w-full flex-1 flex-col gap-6",
            step === 1
              ? "max-w-4xl"
              : step === brandStepIndex && brandPhase === "review" && brandPendingKitId
                ? "max-w-5xl"
                : "max-w-2xl"
          )}
        >
          <div className="flex flex-col items-center gap-4">
            <OnboardingProgressBar step={step} totalSteps={totalSteps} />
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

          <div className="flex min-h-0 flex-1 flex-col items-center gap-6">
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
                    Answer a few quick questions so we can personalize your
                    experience.
                  </p>
                </div>
              </div>
            )}

            {step === 1 && (
              <>
                <div className="w-full max-w-2xl space-y-1 text-center sm:max-w-none">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    What do you want to create?
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Select all that apply — hover a tile to preview
                  </p>
                </div>
                <div className="grid w-full grid-cols-3 gap-3 sm:gap-4">
                  {CREATION_GOAL_OPTIONS.map((opt) => (
                    <CreationGoalMediaTile
                      key={opt.id}
                      label={opt.label}
                      selected={creationGoals.includes(opt.id)}
                      onToggle={() => toggleCreationGoal(opt.id)}
                      media={CREATION_GOAL_MEDIA[opt.id]}
                    />
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
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

            {step === 3 && (
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
                    Name
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

            {step === 4 && (
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

            {step === 5 && (
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

            {step === 6 && (
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

            {step === SOCIAL_CONNECT_STEP ? (
              <div className="flex w-full flex-col items-center gap-6">
                <div className="w-full max-w-md space-y-1 px-2 text-center sm:max-w-xl">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    Connect your social accounts
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Link TikTok or Instagram for publishing and analytics. Optional. You can add
                    accounts anytime in the app.
                  </p>
                </div>
                <div className="mx-auto w-full max-w-xs sm:max-w-xl">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={startOnboardingInstagramConnect}
                      className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-3xl border border-border bg-card/50 p-3 text-center outline-none transition hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring sm:gap-3 sm:p-4"
                    >
                      <SiInstagram className="size-11 shrink-0 sm:size-14" />
                      <span className="text-xs font-semibold leading-tight text-foreground sm:text-sm md:text-base">
                        Connect Instagram
                      </span>
                      <span className="text-[0.65rem] leading-snug text-muted-foreground sm:text-xs">
                        Professional or Creator accounts
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={startOnboardingTikTokConnect}
                      className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-3xl border border-border bg-card/50 p-3 text-center outline-none transition hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring sm:gap-3 sm:p-4"
                    >
                      <SiTiktok className="size-11 shrink-0 sm:size-14" />
                      <span className="text-xs font-semibold leading-tight text-foreground sm:text-sm md:text-base">
                        Connect TikTok
                      </span>
                      <span className="text-[0.65rem] leading-snug text-muted-foreground sm:text-xs">
                        Direct posting from UniCan
                      </span>
                    </button>
                  </div>
                </div>
                {socialConnectRows.length > 0 ? (
                  <div className="w-full max-w-md space-y-2 px-2 sm:max-w-xl">
                    <p className="text-center text-sm font-medium text-foreground">Connected accounts</p>
                    <ul className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/30 p-3">
                      {socialConnectRows.map((row) => (
                        <li
                          key={`${row.provider}-${row.id}`}
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-sm"
                        >
                          {row.provider === "instagram" ? (
                            <SiInstagram className="size-5 shrink-0" />
                          ) : (
                            <SiTiktok className="size-5 shrink-0" />
                          )}
                          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                            {row.label}
                          </span>
                          <span className="shrink-0 text-xs capitalize text-muted-foreground">
                            {row.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === INFLUENCER_ONBOARDING_STEP && wantsCharacter && influencerPhase === "pick" ? (
              <>
                <div className="w-full max-w-2xl space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    Your AI influencer
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Start from a preset or bring reference media. You can refine everything later in your library.
                  </p>
                </div>
                <LayoutGroup id="onboarding-influencer-pick">
                  <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                    <InfluencerPickCard
                      selected={influencerMode === "preset"}
                      onSelect={influencerOpenCreate}
                      title="Create new"
                      description="Pick a curated starter face from presets"
                      icon={<Sparkle className="size-7" weight="duotone" />}
                      layoutId={choiceGlowLayoutId(INFLUENCER_ONBOARDING_STEP, "-mode")}
                    />
                    <InfluencerPickCard
                      selected={influencerMode === "upload"}
                      onSelect={influencerOpenUpload}
                      title="Onboard existing"
                      description="Upload reference photos or short clips we save to Characters"
                      icon={<UploadSimple className="size-7" weight="duotone" />}
                      layoutId={choiceGlowLayoutId(INFLUENCER_ONBOARDING_STEP, "-mode")}
                    />
                  </div>
                </LayoutGroup>
              </>
            ) : null}

            {step === INFLUENCER_ONBOARDING_STEP && wantsCharacter && influencerPhase === "create" ? (
              <>
                <div className="w-full max-w-2xl space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    Pick a preset character
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Starter personas you can customize after onboarding.
                  </p>
                </div>
                <LayoutGroup id="onboarding-influencer-preset">
                  <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
                    {INFLUENCER_PRESETS.map((preset) => (
                      <InfluencerPresetCard
                        key={preset.id}
                        preset={preset}
                        selected={influencerPresetId === preset.id}
                        onSelect={() => influencerSelectPreset(preset.id)}
                        layoutId={choiceGlowLayoutId(INFLUENCER_ONBOARDING_STEP, "-preset")}
                      />
                    ))}
                  </div>
                </LayoutGroup>
              </>
            ) : null}

            {step === INFLUENCER_ONBOARDING_STEP && wantsCharacter && influencerPhase === "upload" ? (
              <>
                <div className="w-full max-w-2xl space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    Reference uploads
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Add a few clear images or short videos. We upload them to your Characters library as private references.
                  </p>
                </div>
                <div className="w-full max-w-2xl">
                  <div
                    className={cn(
                      "relative flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed bg-muted/40 px-5 py-8 text-center transition",
                      influencerDragging
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    )}
                    onDrop={handleInfluencerDrop}
                    onDragOver={handleInfluencerDragOver}
                    onDragEnter={handleInfluencerDragEnter}
                    onDragLeave={handleInfluencerDragLeave}
                  >
                    <input
                      ref={influencerFileInputRef}
                      type="file"
                      accept={INFLUENCER_UPLOAD_ACCEPT}
                      multiple
                      className="hidden"
                      onChange={handleInfluencerFileInputChange}
                    />
                    <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                      <UploadSimple className="size-6" weight="duotone" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Drag and drop, or browse files</p>
                      <p className="text-xs text-muted-foreground">
                        Up to {MAX_INFLUENCER_UPLOADS} files. PNG, JPG, MP4, MOV, WEBM.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => influencerFileInputRef.current?.click()}
                      disabled={
                        influencerBusy || influencerUploads.length >= MAX_INFLUENCER_UPLOADS
                      }
                      className="rounded-full"
                    >
                      <Plus className="size-4" weight="bold" />
                      Add files
                    </Button>
                  </div>

                  {influencerUploads.length > 0 ? (
                    <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {influencerUploads.map((item) => (
                        <InfluencerUploadTile
                          key={item.localId}
                          item={item}
                          onRemove={() => removeInfluencerUpload(item.localId)}
                          disabled={influencerBusy}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {step === CHARACTER_ONBOARDING_STEP && wantsCharacter ? (
              <>
                <div className="w-full max-w-md space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    Onboard your character
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Upload one clear hero photo (face in full view). Next you&apos;ll review details, then we save to your Characters library.
                  </p>
                </div>
                <input
                  ref={characterFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    void handleCharacterFile(e.target.files)
                    e.target.value = ""
                  }}
                />
                <div className="flex w-full max-w-md flex-col gap-4 pb-2">
                  <button
                    type="button"
                    disabled={characterUploadBusy}
                    onClick={() => characterFileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      void handleCharacterFile(e.dataTransfer.files)
                    }}
                    className={cn(
                      "flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/40 px-4 py-8 text-center transition hover:border-primary/50 hover:bg-card/60",
                      characterUploadBusy && "pointer-events-none opacity-60",
                    )}
                  >
                    <UploadSimple className="size-10 text-primary" weight="duotone" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Drag and drop, or browse files</p>
                      <p className="text-xs text-muted-foreground">
                        One image only. PNG or JPG (max 10MB). Face should be clearly visible.
                      </p>
                    </div>
                    <span className="rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-foreground">
                      {characterUploadBusy ? "Uploading…" : "+ Choose image"}
                    </span>
                  </button>
                  {characterDialogInitial?.url ? (
                    <div className="relative w-fit">
                      <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-border bg-muted/20">
                        <Image
                          src={characterDialogInitial.url}
                          alt="Character preview"
                          fill
                          sizes="112px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      {characterAssetSaved ? (
                        <span className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                          <Check className="size-4" weight="bold" />
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {!characterAssetSaved && characterDialogInitial && !characterDialogOpen ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-fit"
                      onClick={() => setCharacterDialogOpen(true)}
                    >
                      Review and save in library
                    </Button>
                  ) : null}
                  {characterAssetSaved ? (
                    <p className="text-xs text-muted-foreground">
                      Saved to your library. Continue to add your brand from a URL, then a note from the founder and terms. Or go Back to change the photo.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            {step === brandStepIndex && brandPhase === "input" ? (
              <>
                <div className="w-full max-w-lg space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    Brand for your ads
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Paste a public link to your site, app store listing, or product page.
                    We&apos;ll draft colors, tone, and logos you can refine in the next step.
                  </p>
                </div>
                <div
                  className={cn(
                    "relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-muted/50 px-5 py-8 ring-1 ring-primary/20",
                    "before:pointer-events-none before:absolute before:inset-y-0 before:right-0 before:w-1/2 before:bg-linear-to-l before:from-primary/15 before:to-transparent",
                  )}
                >
                  <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                    <Sparkle className="h-4 w-4 shrink-0 text-primary/70" weight="fill" aria-hidden />
                    Public pages only. We fetch the page, then run AI on what we see.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                      value={brandUrl}
                      onChange={(e) => setBrandUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void brandSubmitUrl()
                      }}
                      placeholder="yoursite.com or store link"
                      className="h-11 flex-1 rounded-full border-input bg-background text-sm text-foreground placeholder:text-muted-foreground"
                      autoComplete="url"
                    />
                    <Button
                      type="button"
                      onClick={() => void brandSubmitUrl()}
                      disabled={!brandUrl.trim()}
                      className="h-11 shrink-0 rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Analyze
                    </Button>
                  </div>
                  <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-primary/70">
                    <Circle className="h-3 w-3 shrink-0 text-primary/70" weight="regular" aria-hidden />
                    ~30s most of the time; up to ~5 min on slow pages
                  </p>
                </div>
                <p className="max-w-md text-center text-xs text-muted-foreground">
                  Skip if you&apos;re just exploring. You can add a brand kit anytime in the app.
                </p>
              </>
            ) : null}

            {step === brandStepIndex && brandPhase === "analyze" ? (
              <>
                <div className="w-full max-w-md space-y-1 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-primary">
                    Generating your Business DNA
                  </h1>
                </div>
                <div
                  className={cn(
                    "relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-muted/50 px-5 py-10 ring-1 ring-primary/20",
                    "before:pointer-events-none before:absolute before:inset-y-0 before:right-0 before:w-1/2 before:bg-linear-to-l before:from-primary/15 before:to-transparent",
                  )}
                >
                  <h2 className="text-center font-medium leading-tight tracking-tight text-foreground">
                    Hang tight. We&apos;re reading your page
                  </h2>
                  <div
                    className="mt-6 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm text-primary"
                    aria-live="polite"
                  >
                    <Sparkle
                      className="h-4 w-4 shrink-0 animate-pulse text-primary"
                      weight="fill"
                      aria-hidden
                    />
                    <span key={brandAnalysisIndex} className="text-center">
                      {BRAND_ANALYSIS_STATUS_MESSAGES[brandAnalysisIndex]}
                    </span>
                  </div>
                  <div className="mt-5 flex w-full items-center gap-2 rounded-full border border-border bg-muted/70 px-4 py-2.5 text-sm text-primary/90">
                    <LinkSimple className="h-4 w-4 shrink-0 text-primary/80" aria-hidden />
                    <span className="min-w-0 truncate font-mono text-xs">{brandDisplayUrl}</span>
                  </div>
                </div>
              </>
            ) : null}

            {step === brandStepIndex && brandPhase === "review" && brandPendingKitId ? (
              <>
                <div className="w-full max-w-2xl space-y-1 text-center">
                  <h1 className="font-serif text-2xl italic tracking-tight text-primary md:text-3xl">
                    Your Business DNA
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Review and edit your kit, then save and continue. You can change this anytime in Brand settings.
                  </p>
                </div>
                <div className="w-full pb-6">
                  <BrandKitEditor
                    key={brandPendingKitId}
                    ref={brandEditorRef}
                    variant="dialog"
                    forcedKitId={brandPendingKitId}
                    showSaveBarDelete={false}
                    onboardingEmbed
                    className="gap-4"
                  />
                </div>
              </>
            ) : null}

            {step === founderStepIndex ? (
              <>
                <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-3">
                  <h1 className="text-center text-2xl font-semibold tracking-tight text-primary">
                    {FOUNDER_NOTE_TITLE}
                  </h1>
                  <Image
                    src={FOUNDER_NOTE_PHOTO_SRC}
                    alt="Simon"
                    width={40}
                    height={40}
                    className="h-9 w-9 shrink-0 rounded-full border-2 border-border object-cover sm:h-10 sm:w-10"
                  />
                </div>
                <div className="mx-auto w-full max-w-md pb-4">
                  <div className="rounded-3xl border border-border bg-card/60 p-6 shadow-sm">
                    <div className="space-y-4 text-left text-base leading-relaxed text-foreground">
                      {FOUNDER_NOTE_BODY.split("\n\n").map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {step === termsStepIndex ? (
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
            ) : null}
          </div>

        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border/60 bg-background/90 px-4 py-4 backdrop-blur-md">
        {isSocialConnectStep ? (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={socialConnectSkip}
              className="h-12 w-full rounded-full"
            >
              Skip for now
            </Button>
            <div className="flex w-full gap-3">
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
              <Button
                type="button"
                size="lg"
                onClick={goNext}
                disabled={!canGoNext()}
                className="h-12 min-w-0 flex-1 rounded-full"
              >
                Continue
                <ArrowRight className="size-4" weight="bold" data-icon="inline-end" />
              </Button>
            </div>
          </div>
        ) : isInfluencerStep && influencerPhase === "pick" ? (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={influencerSkipPastCharacter}
              disabled={influencerBusy}
              className="h-12 w-full rounded-full"
            >
              Skip for now
            </Button>
            <div className="flex w-full gap-3">
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
              <Button
                type="button"
                size="lg"
                onClick={influencerContinueFromPick}
                disabled={influencerBusy}
                className="h-12 min-w-0 flex-1 rounded-full"
              >
                Continue
                <ArrowRight className="size-4" weight="bold" data-icon="inline-end" />
              </Button>
            </div>
          </div>
        ) : isInfluencerStep && influencerPhase === "create" ? (
          <div className="mx-auto flex w-full max-w-2xl gap-3">
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
            <Button
              type="button"
              size="lg"
              onClick={influencerContinueFromCreate}
              disabled={!influencerPresetId}
              className="h-12 min-w-0 flex-1 rounded-full"
            >
              Continue
              <ArrowRight className="size-4" weight="bold" data-icon="inline-end" />
            </Button>
          </div>
        ) : isInfluencerStep && influencerPhase === "upload" ? (
          <div className="mx-auto flex w-full max-w-2xl gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={goBack}
              disabled={influencerBusy}
              className="h-12 shrink-0 rounded-full px-5"
            >
              <ArrowLeft className="size-4" weight="bold" />
              Back
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={() => void influencerContinueFromUpload()}
              disabled={influencerBusy || influencerUploads.length === 0}
              className="h-12 min-w-0 flex-1 rounded-full"
            >
              {influencerBusy ? "Uploading…" : "Continue"}
              <ArrowRight className="size-4" weight="bold" data-icon="inline-end" />
            </Button>
          </div>
        ) : isCharacterStep && wantsCharacter && !characterAssetSaved ? (
          <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={characterSkipToFounder}
              disabled={characterUploadBusy}
              className="h-12 w-full rounded-full"
            >
              Skip for now
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={goBack}
              disabled={characterUploadBusy}
              className="h-12 w-full rounded-full"
            >
              <ArrowLeft className="size-4" weight="bold" />
              Back
            </Button>
          </div>
        ) : isBrandStep && brandPhase === "analyze" ? (
          <p className="mx-auto max-w-md py-3 text-center text-sm text-muted-foreground">
            Analyzing your page…
          </p>
        ) : isBrandStep && brandPhase === "input" ? (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={brandSkipToFounder}
              className="h-12 w-full rounded-full"
            >
              Skip for now
            </Button>
            <div className="flex w-full gap-3">
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
              <Button
                type="button"
                size="lg"
                onClick={() => void brandSubmitUrl()}
                disabled={!brandUrl.trim()}
                className="h-12 min-w-0 flex-1 rounded-full"
              >
                Analyze URL
                <ArrowRight className="size-4" weight="bold" data-icon="inline-end" />
              </Button>
            </div>
          </div>
        ) : isBrandStep && brandPhase === "review" ? (
          <div className="mx-auto flex w-full max-w-5xl gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={goBack}
              disabled={brandReviewSaving}
              className="h-12 shrink-0 rounded-full px-5"
            >
              <ArrowLeft className="size-4" weight="bold" />
              Back
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={() => void brandReviewContinue()}
              disabled={brandReviewSaving}
              className="h-12 min-w-0 flex-1 rounded-full"
            >
              {brandReviewSaving ? "Saving…" : "Save and continue"}
              <ArrowRight className="size-4" weight="bold" data-icon="inline-end" />
            </Button>
          </div>
        ) : (
        <div
          className={cn(
            "mx-auto flex w-full max-w-md gap-3",
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
          {isLastStep ? (
            <Button
              type="button"
              size="lg"
              onClick={onFinish}
              disabled={!acceptedTerms || pending}
              className="h-12 min-w-0 flex-1 rounded-full"
            >
              {pending ? "Saving…" : "Finish"}
              <ArrowRight className="size-4" weight="bold" data-icon="inline-end" />
            </Button>
          ) : showContinueButton ? (
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
              <ArrowRight className="size-4" weight="bold" data-icon="inline-end" />
            </Button>
          ) : null}
        </div>
        )}
      </div>

      {characterDialogInitial ? (
        <CreateAssetDialog
          key={characterDialogKey}
          open={characterDialogOpen}
          onOpenChange={setCharacterDialogOpen}
          initial={characterDialogInitial}
          autofillOnOpen
          showAutofillButton={false}
          headerTitle="Review your character"
          headerDescription="We prefilled details from your photo using AI. Adjust anything, then save to add this character to your library."
          saveButtonLabel="Save to Characters library"
          onSaved={handleCharacterAssetSaved}
        />
      ) : null}
    </div>
  )
}
