"use client"

import * as React from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import {
  ArrowRightLeft,
  Calendar as CalendarIcon,
  CalendarClock,
  ChevronDown,
  Film,
  Globe,
  ImageIcon,
  Layers,
  LayoutList,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Zap,
} from "lucide-react"
import { format, isBefore, startOfDay, startOfMonth, startOfToday } from "date-fns"
import { toast } from "sonner"

import type { AutopostJobMetadata } from "@/lib/autopost/types"
import { ensureJpegForInstagramFeed } from "@/lib/autopost/convert-image-for-instagram"
import type { InstagramSavedProfile } from "@/lib/instagram/profile"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import {
  AutopostPostMediaViewer,
  type AutopostViewerAction,
} from "@/components/autopost/autopost-post-media-viewer"
import { AutopostPostsCalendar } from "@/components/autopost/autopost-posts-calendar"

const AUTOPOST_MEDIA_FOLDER = "autopost-drafts"

type PostFormat = "feed_image" | "feed_video" | "reel" | "carousel" | "story"

function inferFileKind(file: File): "image" | "video" | null {
  if (file.type.startsWith("image/")) {
    return "image"
  }
  if (file.type.startsWith("video/")) {
    return "video"
  }
  return null
}

function postFormatToApiMediaType(format: PostFormat): "image" | "feed_video" | "reel" | "carousel" | "story" {
  switch (format) {
    case "feed_image":
      return "image"
    case "feed_video":
      return "feed_video"
    case "reel":
      return "reel"
    case "carousel":
      return "carousel"
    case "story":
      return "story"
  }
}

function defaultScheduleDate() {
  return new Date(Date.now() + 60 * 60 * 1000)
}

const SCHEDULE_HOURS = Array.from({ length: 24 }, (_, i) => i)
const SCHEDULE_MINUTES = Array.from({ length: 60 }, (_, i) => i)

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

export type AutopostJobRow = {
  id: string
  provider?: "instagram" | "tiktok" | string | null
  media_url: string
  caption: string | null
  media_type: string
  metadata?: AutopostJobMetadata | null
  status: string
  scheduled_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  last_error: string | null
  provider_publish_id: string | null
  provider_container_id: string | null
  social_connection_id?: string | null
  social_display_name?: string | null
  social_username?: string | null
  instagram_connection_id: string | null
  instagram_username: string | null
}

function formatLocal(iso: string) {
  return new Date(iso).toLocaleString()
}

/** Primary line next to the status badge (human-readable “when” for this status). */
function postStatusTimeLine(job: AutopostJobRow): string {
  switch (job.status) {
    case "published": {
      const t = job.published_at ?? job.updated_at
      return `Published ${formatLocal(t)}`
    }
    case "queued":
      return job.scheduled_at
        ? `Scheduled for ${formatLocal(job.scheduled_at)}`
        : `Queued ${formatLocal(job.created_at)}`
    case "draft":
      return `Saved ${formatLocal(job.created_at)}`
    case "processing":
      return `Publishing… ${formatLocal(job.updated_at)}`
    case "inbox_delivered":
      return `Sent to TikTok inbox ${formatLocal(job.updated_at)}`
    case "failed":
      return `Failed ${formatLocal(job.updated_at)}`
    case "cancelled":
      return `Cancelled ${formatLocal(job.updated_at)}`
    default:
      return formatLocal(job.created_at)
  }
}

/** If the post was scheduled and published at a different time, show context (cron skew). */
function scheduledVsPublishedNote(job: AutopostJobRow): string | null {
  if (job.status !== "published" || !job.scheduled_at || !job.published_at) {
    return null
  }
  const sched = new Date(job.scheduled_at).getTime()
  const pub = new Date(job.published_at).getTime()
  if (!Number.isFinite(sched) || !Number.isFinite(pub)) {
    return null
  }
  if (Math.abs(pub - sched) < 90_000) {
    return null
  }
  return `Originally scheduled for ${formatLocal(job.scheduled_at)}`
}

/** Label for which IG account a job targets (shown prominently in the list). */
function jobAccountLabel(job: AutopostJobRow): string {
  if (job.provider === "tiktok") {
    return job.social_display_name || job.social_username || "TikTok"
  }
  const u = job.instagram_username?.trim()
  if (u) {
    return `@${u}`
  }
  if (job.instagram_connection_id) {
    return `Account ${job.instagram_connection_id.slice(0, 8)}…`
  }
  return "No Instagram link (legacy or disconnected)"
}

const AUTOPOST_COMPOSER_ACCOUNT_KEY = "autopost-composer-instagram-connection-id"

function mediaTypeLabel(mediaType: string): string {
  switch (mediaType) {
    case "image":
      return "Feed photo"
    case "feed_video":
      return "Feed video"
    case "reel":
      return "Reel"
    case "carousel":
      return "Carousel"
    case "story":
      return "Story"
    case "tiktok_video_upload":
      return "TikTok inbox upload"
    case "tiktok_video_direct":
      return "TikTok Direct Post"
    case "tiktok_photo_upload":
      return "TikTok photo inbox upload"
    case "tiktok_photo_direct":
      return "TikTok photo Direct Post"
    default:
      return mediaType
  }
}

function jobListThumbnailIsVideo(job: AutopostJobRow): boolean {
  const t = job.media_type
  if (
    t === "reel" ||
    t === "feed_video" ||
    t === "tiktok_video_upload" ||
    t === "tiktok_video_direct"
  ) {
    return true
  }
  if (t === "story") {
    return job.metadata?.assetKind === "video"
  }
  if (t === "carousel") {
    return job.metadata?.carouselItems?.[0]?.kind === "video"
  }
  return false
}

function inferMediaKindFromUrl(url: string): "image" | "video" | null {
  try {
    const pathname = new URL(url).pathname
    if (/\.(mp4|mov|webm|m4v)$/i.test(pathname)) {
      return "video"
    }
    if (/\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(pathname)) {
      return "image"
    }
  } catch {
    return null
  }
  return null
}

function isJpegBackedUrl(url: string): boolean {
  try {
    return /\.(jpe?g)$/i.test(new URL(url).pathname)
  } catch {
    return false
  }
}

function getJobMediaItems(job: AutopostJobRow): ComposerMediaItem[] {
  if (job.media_type === "carousel") {
    return (job.metadata?.carouselItems ?? [])
      .map((item, index) => ({
        url: item.url,
        kind: item.kind,
        label: `${index + 1}`,
        origin: "repurpose" as const,
      }))
      .filter((item) => item.url)
  }

  if (job.media_type === "tiktok_photo_upload" || job.media_type === "tiktok_photo_direct") {
    return (job.metadata?.tiktok?.photoItems ?? [])
      .map((item, index) => ({
        url: item.url,
        kind: "image" as const,
        label: `${index + 1}`,
        origin: "repurpose" as const,
      }))
      .filter((item) => item.url)
  }

  const explicitKind =
    job.media_type === "feed_video" ||
    job.media_type === "reel" ||
    job.media_type === "tiktok_video_upload" ||
    job.media_type === "tiktok_video_direct"
      ? "video"
      : job.media_type === "story"
        ? job.metadata?.assetKind === "video"
          ? "video"
          : "image"
        : inferMediaKindFromUrl(job.media_url) ?? (jobListThumbnailIsVideo(job) ? "video" : "image")

  return job.media_url
    ? [
        {
          url: job.media_url,
          kind: explicitKind,
          label: "1",
          origin: "repurpose" as const,
        },
      ]
    : []
}

function jobAllowsPerSlideRemoval(job: AutopostJobRow): boolean {
  if (job.status !== "draft" && job.status !== "queued") {
    return false
  }
  const items = getJobMediaItems(job)
  if (job.media_type === "carousel") {
    return items.length > 2
  }
  if (job.media_type === "tiktok_photo_upload" || job.media_type === "tiktok_photo_direct") {
    return items.length > 1
  }
  return false
}

function jobAllowsGalleryReorder(job: AutopostJobRow): boolean {
  if (job.status !== "draft" && job.status !== "queued") {
    return false
  }
  const items = getJobMediaItems(job)
  if (items.length < 2) {
    return false
  }
  const t = job.media_type
  return t === "carousel" || t === "tiktok_photo_upload" || t === "tiktok_photo_direct"
}

function jobCaptionForViewer(job: AutopostJobRow): string | null {
  const cap = job.caption
  const capTrimmed = typeof cap === "string" ? cap.trim() : ""
  if (capTrimmed.length > 0) {
    return cap
  }
  const tiktokDesc = job.metadata?.tiktok?.description
  const descTrimmed = typeof tiktokDesc === "string" ? tiktokDesc.trim() : ""
  if (descTrimmed.length > 0 && job.provider === "tiktok") {
    return tiktokDesc ?? null
  }
  return null
}

function jobAllowsCaptionEdit(job: AutopostJobRow): boolean {
  return job.status === "draft" || job.status === "queued" || job.status === "failed"
}

function getJobViewerIcon(job: AutopostJobRow): "image" | "video" | "carousel" | "story" {
  if (
    job.media_type === "carousel" ||
    job.media_type === "tiktok_photo_upload" ||
    job.media_type === "tiktok_photo_direct"
  ) {
    return "carousel"
  }
  if (
    job.media_type === "feed_video" ||
    job.media_type === "reel" ||
    job.media_type === "tiktok_video_upload" ||
    job.media_type === "tiktok_video_direct"
  ) {
    return "video"
  }
  if (job.media_type === "story") {
    return "story"
  }
  return "image"
}

function connectedInstagramRepurposeAccounts(connections: SocialConnectionItem[]) {
  return connections
    .filter((connection) => connection.status === "connected" && connection.instagramConnectionId)
    .map((connection) => ({
      id: connection.instagramConnectionId as string,
      label: connection.instagramUsername ? `@${connection.instagramUsername}` : connection.displayName || "Instagram account",
    }))
}

function connectedTikTokRepurposeAccounts(connections: SocialConnectionItem[]) {
  return connections
    .filter((connection) => connection.status === "connected")
    .map((connection) => ({
      id: connection.id,
      label: connection.displayName || connection.username || "TikTok account",
    }))
}

function getRepurposeTargets(
  job: AutopostJobRow,
  instagramConnections: SocialConnectionItem[],
  tiktokConnections: SocialConnectionItem[],
): RepurposeTargetOption[] {
  const instagramAccounts = connectedInstagramRepurposeAccounts(instagramConnections)
  const tiktokAccounts = connectedTikTokRepurposeAccounts(tiktokConnections)
  const mediaItems = getJobMediaItems(job)
  const pushUnique = (list: RepurposeTargetSpec[], next: RepurposeTargetSpec) => {
    if (!list.some((item) => item.id === next.id)) {
      list.push(next)
    }
  }

  if (mediaItems.length === 0) {
    return []
  }

  const list: RepurposeTargetSpec[] = []
  const single = mediaItems.length === 1 ? mediaItems[0] : null
  const allImages = mediaItems.every((item) => item.kind === "image")
  const sourceProvider: ComposerProvider = job.provider === "tiktok" ? "tiktok" : "instagram"

  if (mediaItems.length > 1) {
    if (allImages) {
      if (sourceProvider === "tiktok") {
        pushUnique(list, {
          id: "instagram:carousel",
          provider: "instagram",
          label: "Instagram carousel",
          postFormat: "carousel",
        })
        pushUnique(list, {
          id: "tiktok:photo",
          provider: "tiktok",
          label: "TikTok photo post",
          tiktokPostType: "photo",
        })
      } else {
        pushUnique(list, {
          id: "tiktok:photo",
          provider: "tiktok",
          label: "TikTok photo post",
          tiktokPostType: "photo",
        })
        pushUnique(list, {
          id: "instagram:carousel",
          provider: "instagram",
          label: "Instagram carousel",
          postFormat: "carousel",
        })
      }
    } else {
      pushUnique(list, {
        id: "instagram:carousel",
        provider: "instagram",
        label: "Instagram carousel",
        postFormat: "carousel",
      })
    }
  } else if (single?.kind === "image") {
    if (isJpegBackedUrl(single.url)) {
      pushUnique(list, {
        id: "instagram:feed_image",
        provider: "instagram",
        label: "Instagram feed photo",
        postFormat: "feed_image",
      })
    }
    pushUnique(list, {
      id: "instagram:story",
      provider: "instagram",
      label: "Instagram story",
      postFormat: "story",
    })
    pushUnique(list, {
      id: "tiktok:photo",
      provider: "tiktok",
      label: "TikTok photo post",
      tiktokPostType: "photo",
    })
  } else if (single?.kind === "video") {
    if (job.media_type === "story") {
      pushUnique(list, {
        id: "instagram:story",
        provider: "instagram",
        label: "Instagram story",
        postFormat: "story",
      })
    }
    pushUnique(list, {
      id: "instagram:reel",
      provider: "instagram",
      label: "Instagram reel",
      postFormat: "reel",
    })
    pushUnique(list, {
      id: "instagram:feed_video",
      provider: "instagram",
      label: "Instagram feed video",
      postFormat: "feed_video",
    })
    pushUnique(list, {
      id: "tiktok:video",
      provider: "tiktok",
      label: "TikTok video post",
      tiktokPostType: "video",
    })
  }

  return list
    .map((target) => ({
      ...target,
      accounts: target.provider === "instagram" ? instagramAccounts : tiktokAccounts,
    }))
    .filter((target) => target.accounts.length > 0)
}

function repurposeAllowsMove(job: AutopostJobRow) {
  return job.status === "draft" || job.status === "queued"
}

function targetMatchesComposer(
  target: RepurposeTargetSpec,
  provider: ComposerProvider,
  postFormat: PostFormat,
  tiktokPostType: TikTokPostType,
) {
  return target.provider === provider && (
    (provider === "instagram" && target.postFormat === postFormat) ||
    (provider === "tiktok" && target.tiktokPostType === tiktokPostType)
  )
}

type SocialProvider = "instagram" | "tiktok"

type SocialConnectionItem = {
  id: string
  provider: SocialProvider
  providerAccountId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  status: "connected" | "disconnected" | "error" | "expired" | string
  scopes: string[]
  refreshTokenExpiresAt: string | null
  metadata?: Record<string, unknown>
  profile: InstagramSavedProfile | TikTokSavedProfile | null
  instagramConnectionId: string | null
  instagramUsername: string | null
  instagramUserId: string | null
  accountType: string | null
  tokenExpiresAt: string | null
  updatedAt: string
}

type SocialProviderStatus = {
  connected: boolean
  connections: SocialConnectionItem[]
}

type SocialConnectionsStatus = {
  providers?: {
    instagram?: SocialProviderStatus
    tiktok?: SocialProviderStatus
  }
  instagram?: SocialProviderStatus
  tiktok?: SocialProviderStatus
}

type TikTokSavedProfile = {
  open_id: string
  display_name: string | null
  avatar_url: string | null
  fetched_at: string
}

type DisconnectTarget = {
  provider: SocialProvider
  connectionId: string
  label: string
}

type ComposerProvider = "instagram" | "tiktok"
type TikTokMode = "upload" | "direct"
type TikTokPostType = "video" | "photo"
type RepurposeIntent = "copy" | "move"

type TikTokCreatorInfo = {
  creator_avatar_url?: string
  creator_username?: string
  creator_nickname?: string
  privacy_level_options?: string[]
  comment_disabled?: boolean
  duet_disabled?: boolean
  stitch_disabled?: boolean
  max_video_post_duration_sec?: number
}

type ComposerMediaItem = {
  url: string
  kind: "image" | "video"
  label?: string
  origin: "local" | "repurpose"
  name?: string
}

type RepurposeTargetSpec = {
  id: string
  provider: ComposerProvider
  label: string
  postFormat?: PostFormat
  tiktokPostType?: TikTokPostType
}

type RepurposeTargetOption = RepurposeTargetSpec & {
  accounts: Array<{ id: string; label: string }>
}

type RepurposeSource = {
  sourceJobId: string
  sourceProvider: ComposerProvider
  sourceStatus: string
  sourceLabel: string
  intent: RepurposeIntent
  mediaItems: ComposerMediaItem[]
  allowedTargets: RepurposeTargetSpec[]
  caption: string
  tiktokDescription: string
  photoCoverIndex: number
  shareReelToFeed: boolean
  reelCoverUrl: string
}

type RepurposeDialogState = {
  job: AutopostJobRow
  targets: RepurposeTargetOption[]
  selectedTargetId: string
  selectedAccountId: string | null
}

function hasScope(connection: SocialConnectionItem | null | undefined, scope: string) {
  return connection?.scopes?.includes(scope) === true
}

function privacyLabel(value: string) {
  switch (value) {
    case "PUBLIC_TO_EVERYONE":
      return "Public"
    case "MUTUAL_FOLLOW_FRIENDS":
      return "Friends"
    case "FOLLOWER_OF_CREATOR":
      return "Followers"
    case "SELF_ONLY":
      return "Only me"
    default:
      return value
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "draft":
      return "Draft"
    case "queued":
      return "Scheduled"
    case "processing":
      return "Publishing"
    case "published":
      return "Published"
    case "inbox_delivered":
      return "Inbox delivered"
    case "failed":
      return "Failed"
    case "cancelled":
      return "Cancelled"
    default:
      return status
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "published":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    case "inbox_delivered":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    case "queued":
      return "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300"
    case "processing":
      return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
    case "failed":
      return "border-destructive/40 bg-destructive/10 text-destructive"
    case "cancelled":
      return "border-muted-foreground/30 bg-muted text-muted-foreground"
    case "draft":
    default:
      return ""
  }
}

function providerLabel(provider: SocialProvider) {
  return provider === "tiktok" ? "TikTok" : "Instagram"
}

function providerIconSrc(provider: SocialProvider) {
  return provider === "tiktok" ? "/brand_icons/tiktok-icon.svg" : "/brand_icons/instagram-icon.svg"
}

function BrandIcon({ provider, className }: { provider: SocialProvider; className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden
      className={cn(provider === "instagram" && "dark:invert", className)}
      height={20}
      src={providerIconSrc(provider)}
      width={20}
    />
  )
}

export function AutopostPage() {
  const [status, setStatus] = React.useState<SocialConnectionsStatus | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = React.useState(true)
  const [isDisconnecting, setIsDisconnecting] = React.useState(false)
  const [refreshingConnectionId, setRefreshingConnectionId] = React.useState<string | null>(null)
  const [composerProvider, setComposerProvider] = React.useState<ComposerProvider>("instagram")
  const [selectedComposerConnectionId, setSelectedComposerConnectionId] = React.useState<string | null>(null)
  const [selectedTikTokConnectionId, setSelectedTikTokConnectionId] = React.useState<string | null>(null)
  const [tiktokMode, setTikTokMode] = React.useState<TikTokMode>("upload")
  const [tiktokPostType, setTikTokPostType] = React.useState<TikTokPostType>("video")
  const [tiktokPrivacyLevel, setTikTokPrivacyLevel] = React.useState("SELF_ONLY")
  const [tiktokDisableComment, setTikTokDisableComment] = React.useState(false)
  const [tiktokDisableDuet, setTikTokDisableDuet] = React.useState(false)
  const [tiktokDisableStitch, setTikTokDisableStitch] = React.useState(false)
  const [tiktokIsAigc, setTikTokIsAigc] = React.useState(true)
  const [tiktokAutoAddMusic, setTikTokAutoAddMusic] = React.useState(true)
  const [tiktokBrandOrganic, setTikTokBrandOrganic] = React.useState(false)
  const [tiktokBrandContent, setTikTokBrandContent] = React.useState(false)
  const [tiktokDescription, setTikTokDescription] = React.useState("")
  const [tiktokPhotoCoverIndex, setTikTokPhotoCoverIndex] = React.useState(0)
  const [tiktokCreatorInfo, setTikTokCreatorInfo] = React.useState<TikTokCreatorInfo | null>(null)
  const [isLoadingTikTokCreatorInfo, setIsLoadingTikTokCreatorInfo] = React.useState(false)
  const [caption, setCaption] = React.useState("")
  const [postFormat, setPostFormat] = React.useState<PostFormat>("feed_image")
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([])
  const [shareReelToFeed, setShareReelToFeed] = React.useState(true)
  const [reelCoverUrl, setReelCoverUrl] = React.useState("")
  const [composerTab, setComposerTab] = React.useState<"now" | "schedule">("now")
  const [scheduleDate, setScheduleDate] = React.useState(defaultScheduleDate)
  const [schedulePickerOpen, setSchedulePickerOpen] = React.useState(false)

  const [jobs, setJobs] = React.useState<AutopostJobRow[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = React.useState(true)
  const [isPostingDraft, setIsPostingDraft] = React.useState(false)
  const [actionJobId, setActionJobId] = React.useState<string | null>(null)
  const [activeViewerJob, setActiveViewerJob] = React.useState<{
    job: AutopostJobRow
    mediaItems: ComposerMediaItem[]
  } | null>(null)
  const [galleryRemovalIndex, setGalleryRemovalIndex] = React.useState<number | null>(null)
  const [galleryReorderBusy, setGalleryReorderBusy] = React.useState(false)
  const [captionSaveBusy, setCaptionSaveBusy] = React.useState(false)
  const [composerOpen, setComposerOpen] = React.useState(false)
  const [repurposeDialog, setRepurposeDialog] = React.useState<RepurposeDialogState | null>(null)
  const [repurposeSource, setRepurposeSource] = React.useState<RepurposeSource | null>(null)
  const [connectIconProvider, setConnectIconProvider] = React.useState<SocialProvider>("instagram")

  const [postsViewMode, setPostsViewMode] = React.useState<"list" | "calendar">("calendar")
  const [postsCalendarMonth, setPostsCalendarMonth] = React.useState(() => startOfMonth(new Date()))
  const [postsAccountFilterId, setPostsAccountFilterId] = React.useState<string | null>(null)

  const [disconnectTarget, setDisconnectTarget] = React.useState<DisconnectTarget | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()
  const hasHandledAuthParams = React.useRef(false)

  const localComposerMediaItems = React.useMemo<ComposerMediaItem[]>(
    () =>
      previewUrls.reduce<ComposerMediaItem[]>((items, url, index) => {
        const file = selectedFiles[index]
        const kind = file ? inferFileKind(file) : null
        if (!kind) {
          return items
        }
        items.push({
          url,
          kind,
          label: `${index + 1}`,
          origin: "local",
          name: file.name,
        })
        return items
      }, []),
    [previewUrls, selectedFiles],
  )

  const composerMediaItems = repurposeSource?.mediaItems?.length ? repurposeSource.mediaItems : localComposerMediaItems

  const clearLocalComposerMedia = React.useCallback(() => {
    setSelectedFiles([])
    setPreviewUrls((previous) => {
      previous.forEach((u) => URL.revokeObjectURL(u))
      return []
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  React.useEffect(() => {
    return () => {
      previewUrls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [previewUrls])

  React.useEffect(() => {
    if (!activeViewerJob) {
      setGalleryRemovalIndex(null)
      setCaptionSaveBusy(false)
      setGalleryReorderBusy(false)
    }
  }, [activeViewerJob])

  React.useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      clearLocalComposerMedia()
      if (postFormat === "story") {
        setCaption("")
      }
    })
    return () => {
      cancelled = true
    }
  }, [clearLocalComposerMedia, composerProvider, postFormat, tiktokPostType])

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setConnectIconProvider((current) => (current === "instagram" ? "tiktok" : "instagram"))
    }, 2600)

    return () => window.clearInterval(intervalId)
  }, [])

  const fetchStatus = React.useCallback(async () => {
    setIsLoadingStatus(true)
    try {
      const response = await fetch("/api/social-connections/status", { cache: "no-store" })
      const data = (await response.json()) as SocialConnectionsStatus | { error?: string }

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Failed to load social connection status.")
      }

      const payload = data as SocialConnectionsStatus
      const instagram = payload.providers?.instagram ?? payload.instagram ?? { connected: false, connections: [] }
      const tiktok = payload.providers?.tiktok ?? payload.tiktok ?? { connected: false, connections: [] }
      setStatus({
        providers: { instagram, tiktok },
        instagram,
        tiktok,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load social connection status")
      const emptyStatus = {
        instagram: { connected: false, connections: [] },
        tiktok: { connected: false, connections: [] },
      }
      setStatus({ providers: emptyStatus, ...emptyStatus })
    } finally {
      setIsLoadingStatus(false)
    }
  }, [])

  const handleRefreshProfile = React.useCallback(
    async (connectionId: string) => {
      setRefreshingConnectionId(connectionId)
      try {
        const response = await fetch("/api/instagram/refresh-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId }),
        })
        const data = (await response.json()) as { ok?: boolean; error?: string }
        if (!response.ok) {
          throw new Error(data.error || "Could not refresh Instagram profile.")
        }
        toast.success("Profile data updated.")
        void fetchStatus()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not refresh profile")
      } finally {
        setRefreshingConnectionId(null)
      }
    },
    [fetchStatus]
  )

  React.useEffect(() => {
    const list = status?.instagram?.connections ?? []
    const publishableConnections = list.filter(
      (c) => c.instagramConnectionId && c.status === "connected"
    )
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (list.length === 0) {
        setSelectedComposerConnectionId(null)
        return
      }
      setSelectedComposerConnectionId((current) => {
        if (current && publishableConnections.some((c) => c.instagramConnectionId === current)) {
          return current
        }
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem(AUTOPOST_COMPOSER_ACCOUNT_KEY)
          if (stored && publishableConnections.some((c) => c.instagramConnectionId === stored)) {
            return stored
          }
        }
        return publishableConnections[0]?.instagramConnectionId ?? null
      })
    })
    return () => {
      cancelled = true
    }
  }, [status?.instagram?.connections])

  React.useEffect(() => {
    const list = status?.tiktok?.connections ?? []
    const connected = list.filter((c) => c.status === "connected")
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (connected.length === 0) {
        setSelectedTikTokConnectionId(null)
        return
      }
      setSelectedTikTokConnectionId((current) => {
        if (current && connected.some((c) => c.id === current)) {
          return current
        }
        return connected[0].id
      })
    })
    return () => {
      cancelled = true
    }
  }, [status?.tiktok?.connections])

  React.useEffect(() => {
    if (composerProvider !== "tiktok" || tiktokMode !== "direct" || !selectedTikTokConnectionId) {
      queueMicrotask(() => setTikTokCreatorInfo(null))
      return
    }

    const connection = status?.tiktok?.connections.find((c) => c.id === selectedTikTokConnectionId)
    if (!hasScope(connection, "video.publish")) {
      queueMicrotask(() => setTikTokCreatorInfo(null))
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setIsLoadingTikTokCreatorInfo(true)
      }
    })
    fetch(`/api/tiktok/creator-info?connectionId=${encodeURIComponent(selectedTikTokConnectionId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as { creatorInfo?: TikTokCreatorInfo; error?: string }
        if (!response.ok) {
          throw new Error(data.error || "Could not load TikTok creator settings.")
        }
        if (cancelled) return
        const info = data.creatorInfo ?? null
        setTikTokCreatorInfo(info)
        const options = info?.privacy_level_options ?? []
        setTikTokPrivacyLevel((current) =>
          options.length > 0 && !options.includes(current) ? (options.includes("SELF_ONLY") ? "SELF_ONLY" : options[0]) : current,
        )
        setTikTokDisableComment(info?.comment_disabled === true)
        setTikTokDisableDuet(info?.duet_disabled === true)
        setTikTokDisableStitch(info?.stitch_disabled === true)
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Could not load TikTok creator settings.")
          setTikTokCreatorInfo(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTikTokCreatorInfo(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [composerProvider, selectedTikTokConnectionId, status?.tiktok?.connections, tiktokMode])

  React.useEffect(() => {
    if (composerProvider !== "tiktok" || tiktokPostType !== "photo") {
      return
    }
    if (composerMediaItems.length === 0) {
      setTikTokPhotoCoverIndex(0)
      return
    }
    setTikTokPhotoCoverIndex((current) => (current >= 0 && current < composerMediaItems.length ? current : 0))
  }, [composerMediaItems.length, composerProvider, tiktokPostType])

  const fetchJobs = React.useCallback(async () => {
    setIsLoadingJobs(true)
    try {
      const response = await fetch("/api/autopost/jobs", { cache: "no-store" })
      const data = (await response.json()) as { jobs?: AutopostJobRow[]; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to load posts.")
      }
      setJobs(data.jobs ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load posts")
      setJobs([])
    } finally {
      setIsLoadingJobs(false)
    }
  }, [])

  React.useEffect(() => {
    queueMicrotask(() => {
      void fetchStatus()
      void fetchJobs()
    })
  }, [fetchStatus, fetchJobs])

  React.useEffect(() => {
    if (hasHandledAuthParams.current) {
      return
    }

    const error = searchParams.get("error")
    const connected = searchParams.get("connected")
    const provider = searchParams.get("provider")

    if (!error && !connected) {
      return
    }

    hasHandledAuthParams.current = true

    if (error) {
      toast.error(error)
    } else if (connected === "1") {
      toast.success(provider === "tiktok" ? "TikTok account connected." : "Instagram account connected.")
      queueMicrotask(() => void fetchStatus())
    }

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.delete("error")
    nextUrl.searchParams.delete("connected")
    nextUrl.searchParams.delete("provider")
    const search = nextUrl.searchParams.toString()
    window.history.replaceState({}, "", search ? `${nextUrl.pathname}?${search}` : nextUrl.pathname)
  }, [fetchStatus, searchParams])

  const handleComposerProviderChange = React.useCallback(
    (value: string) => {
      const nextProvider = value as ComposerProvider
      setComposerProvider(nextProvider)

      if (!repurposeSource) {
        return
      }

      const targetsForProvider = repurposeSource.allowedTargets.filter((target) => target.provider === nextProvider)
      if (targetsForProvider.length === 0) {
        setRepurposeSource(null)
        return
      }

      const currentTarget = targetsForProvider.find((target) =>
        targetMatchesComposer(target, nextProvider, postFormat, tiktokPostType),
      )
      const resolvedTarget = currentTarget ?? targetsForProvider[0]

      if (nextProvider === "instagram" && resolvedTarget.postFormat) {
        setPostFormat(resolvedTarget.postFormat)
      }
      if (nextProvider === "tiktok" && resolvedTarget.tiktokPostType) {
        setTikTokPostType(resolvedTarget.tiktokPostType)
      }
    },
    [postFormat, repurposeSource, tiktokPostType],
  )

  const handleInstagramPostFormatChange = React.useCallback(
    (value: string) => {
      const nextFormat = value as PostFormat
      if (
        repurposeSource &&
        !repurposeSource.allowedTargets.some(
          (target) => target.provider === "instagram" && target.postFormat === nextFormat,
        )
      ) {
        return
      }
      setPostFormat(nextFormat)
    },
    [repurposeSource],
  )

  const handleTikTokPostTypeChange = React.useCallback(
    (value: string) => {
      const nextType = value as TikTokPostType
      if (
        repurposeSource &&
        !repurposeSource.allowedTargets.some(
          (target) => target.provider === "tiktok" && target.tiktokPostType === nextType,
        )
      ) {
        return
      }
      setTikTokPostType(nextType)
    },
    [repurposeSource],
  )

  const openRepurposeDialog = React.useCallback(
    (job: AutopostJobRow) => {
      const targets = getRepurposeTargets(
        job,
        status?.instagram?.connections ?? [],
        status?.tiktok?.connections ?? [],
      )
      if (targets.length === 0) {
        toast.error("No compatible repurpose targets are available for this post yet.")
        return
      }

      const defaultTarget = targets[0]
      setRepurposeDialog({
        job,
        targets,
        selectedTargetId: defaultTarget.id,
        selectedAccountId: defaultTarget.accounts[0]?.id ?? null,
      })
    },
    [status],
  )

  const applyRepurposeSelection = React.useCallback(
    (intent: RepurposeIntent) => {
      if (!repurposeDialog) {
        return
      }

      const selectedTarget = repurposeDialog.targets.find((target) => target.id === repurposeDialog.selectedTargetId)
      if (!selectedTarget) {
        toast.error("Choose a compatible destination first.")
        return
      }

      const selectedAccountId = repurposeDialog.selectedAccountId ?? selectedTarget.accounts[0]?.id ?? null
      if (!selectedAccountId) {
        toast.error("Choose an account for the repurposed post.")
        return
      }

      const mediaItems = getJobMediaItems(repurposeDialog.job)
      if (mediaItems.length === 0) {
        toast.error("This post is missing media to repurpose.")
        return
      }

      const sourceDescription = repurposeDialog.job.metadata?.tiktok?.description?.trim() ?? ""
      const combinedInstagramCaption =
        repurposeDialog.job.provider === "tiktok" &&
        (repurposeDialog.job.media_type === "tiktok_photo_upload" ||
          repurposeDialog.job.media_type === "tiktok_photo_direct") &&
        sourceDescription
          ? [repurposeDialog.job.caption?.trim(), sourceDescription].filter(Boolean).join("\n\n")
          : repurposeDialog.job.caption ?? ""

      clearLocalComposerMedia()
      setRepurposeSource({
        sourceJobId: repurposeDialog.job.id,
        sourceProvider: repurposeDialog.job.provider === "tiktok" ? "tiktok" : "instagram",
        sourceStatus: repurposeDialog.job.status,
        sourceLabel: jobAccountLabel(repurposeDialog.job),
        intent,
        mediaItems,
        allowedTargets: repurposeDialog.targets.map((target) => ({
          id: target.id,
          label: target.label,
          provider: target.provider,
          postFormat: target.postFormat,
          tiktokPostType: target.tiktokPostType,
        })),
        caption: selectedTarget.provider === "instagram" ? combinedInstagramCaption : repurposeDialog.job.caption ?? "",
        tiktokDescription:
          selectedTarget.provider === "tiktok" && selectedTarget.tiktokPostType === "photo"
            ? sourceDescription
            : "",
        photoCoverIndex:
          repurposeDialog.job.metadata?.tiktok?.photoCoverIndex != null
            ? Math.min(
                Math.max(repurposeDialog.job.metadata.tiktok.photoCoverIndex, 0),
                Math.max(mediaItems.length - 1, 0),
              )
            : 0,
        shareReelToFeed: repurposeDialog.job.metadata?.publishOptions?.shareToFeed !== false,
        reelCoverUrl: repurposeDialog.job.metadata?.publishOptions?.coverUrl ?? "",
      })

      setCaption(selectedTarget.provider === "instagram" ? combinedInstagramCaption : repurposeDialog.job.caption ?? "")
      setTikTokDescription(
        selectedTarget.provider === "tiktok" && selectedTarget.tiktokPostType === "photo" ? sourceDescription : "",
      )
      setTikTokPhotoCoverIndex(
        repurposeDialog.job.metadata?.tiktok?.photoCoverIndex != null
          ? Math.min(
              Math.max(repurposeDialog.job.metadata.tiktok.photoCoverIndex, 0),
              Math.max(mediaItems.length - 1, 0),
            )
          : 0,
      )
      setShareReelToFeed(repurposeDialog.job.metadata?.publishOptions?.shareToFeed !== false)
      setReelCoverUrl(repurposeDialog.job.metadata?.publishOptions?.coverUrl ?? "")
      setComposerProvider(selectedTarget.provider)
      if (selectedTarget.provider === "instagram") {
        setPostFormat(selectedTarget.postFormat ?? "feed_image")
        setSelectedComposerConnectionId(selectedAccountId)
        if (typeof window !== "undefined") {
          localStorage.setItem(AUTOPOST_COMPOSER_ACCOUNT_KEY, selectedAccountId)
        }
      } else {
        setTikTokPostType(selectedTarget.tiktokPostType ?? "video")
        setSelectedTikTokConnectionId(selectedAccountId)
      }
      setComposerTab("now")
      setRepurposeDialog(null)
      setComposerOpen(true)
    },
    [clearLocalComposerMedia, repurposeDialog],
  )

  const finalizeRepurposeMoveIfNeeded = React.useCallback(async () => {
    if (!repurposeSource || repurposeSource.intent !== "move") {
      return
    }

    if (repurposeSource.sourceStatus !== "draft" && repurposeSource.sourceStatus !== "queued") {
      return
    }

    const response = await fetch(`/api/autopost/jobs/${repurposeSource.sourceJobId}`, { method: "DELETE" })
    const data = (await response.json()) as { error?: string }
    if (!response.ok) {
      throw new Error(data.error || "Repurpose succeeded, but the original draft could not be removed.")
    }
  }, [repurposeSource])

  const handleConnectInstagram = () => {
    window.location.href = "/api/instagram/connect"
  }

  const handleConnectTikTok = () => {
    window.location.href = "/api/tiktok/connect"
  }

  const handleDisconnect = async () => {
    if (!disconnectTarget) {
      return
    }
    const target = disconnectTarget
    setIsDisconnecting(true)
    try {
      const response = await fetch(
        target.provider === "tiktok" ? "/api/tiktok/disconnect" : "/api/instagram/disconnect",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: target.connectionId }),
        }
      )
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(
          data.error ||
            `Failed to disconnect ${target.provider === "tiktok" ? "TikTok" : "Instagram"} account.`
        )
      }
      toast.success(`${target.provider === "tiktok" ? "TikTok" : "Instagram"} account disconnected.`)
      setDisconnectTarget(null)
      if (
        typeof window !== "undefined" &&
        localStorage.getItem(AUTOPOST_COMPOSER_ACCOUNT_KEY) === target.connectionId
      ) {
        localStorage.removeItem(AUTOPOST_COMPOSER_ACCOUNT_KEY)
      }
      await fetchStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect account")
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleMediaFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isCarousel = composerProvider === "instagram" && postFormat === "carousel"
    const isTikTokPhoto = composerProvider === "tiktok" && tiktokPostType === "photo"
    const picked =
      isCarousel || isTikTokPhoto
        ? Array.from(event.target.files ?? [])
        : event.target.files?.[0]
          ? [event.target.files[0]]
          : []

    if (picked.length === 0) {
      setSelectedFiles([])
      setPreviewUrls((previous) => {
        previous.forEach((u) => URL.revokeObjectURL(u))
        return []
      })
      return
    }

    if (isTikTokPhoto && picked.length > 35) {
      toast.error("TikTok photo posts support up to 35 images.")
      event.target.value = ""
      return
    }

    for (const file of picked) {
      const kind = inferFileKind(file)
      if (!kind) {
        toast.error("Use images (JPEG, PNG, WebP, GIF) or video (MP4, MOV).")
        event.target.value = ""
        return
      }
      if (isTikTokPhoto && kind !== "image") {
        toast.error("TikTok photo posts require image files only.")
        event.target.value = ""
        return
      }
      if (composerProvider === "tiktok" && tiktokPostType === "video" && kind !== "video") {
        toast.error("TikTok video posts require a video file.")
        event.target.value = ""
        return
      }
    }

    setRepurposeSource(null)
    setPreviewUrls((previous) => {
      previous.forEach((u) => URL.revokeObjectURL(u))
      return picked.map((file) => URL.createObjectURL(file))
    })
    setSelectedFiles(picked)
  }

  const resetComposer = () => {
    setCaption("")
    clearLocalComposerMedia()
    setRepurposeSource(null)
    setShareReelToFeed(true)
    setReelCoverUrl("")
    setTikTokPostType("video")
    setTikTokBrandOrganic(false)
    setTikTokBrandContent(false)
    setTikTokIsAigc(true)
    setTikTokAutoAddMusic(true)
    setTikTokDescription("")
    setTikTokPhotoCoverIndex(0)
    setScheduleDate(defaultScheduleDate())
  }

  const uploadAndCreateDraft = async (scheduledAtIso: string | null) => {
    const usingRepurposeMedia = selectedFiles.length === 0 && Boolean(repurposeSource?.mediaItems.length)
    const sourceMediaItems = usingRepurposeMedia ? repurposeSource?.mediaItems ?? [] : localComposerMediaItems

    if (sourceMediaItems.length === 0) {
      toast.error("Choose media first.")
      return null
    }

    if (composerProvider === "tiktok") {
      if (!selectedTikTokConnectionId) {
        toast.error("Select a TikTok account for this post.")
        return null
      }
      const connection = status?.tiktok?.connections.find((c) => c.id === selectedTikTokConnectionId)
      const requiredScope = tiktokMode === "direct" ? "video.publish" : "video.upload"
      if (!hasScope(connection, requiredScope)) {
        toast.error(`Reconnect TikTok and approve ${tiktokMode === "direct" ? "Direct Post" : "upload"} permissions.`)
        return null
      }
      if (tiktokMode === "direct" && !tiktokPrivacyLevel) {
        toast.error("Pick a TikTok privacy level.")
        return null
      }

      const body: Record<string, unknown> = {
        provider: "tiktok",
        caption,
        tiktokConnectionId: selectedTikTokConnectionId,
        tiktokMode,
        tiktokPostType,
        isAigc: tiktokIsAigc,
        brandOrganicToggle: tiktokBrandOrganic,
        brandContentToggle: tiktokBrandContent,
      }
      if (scheduledAtIso) {
        body.scheduledAt = scheduledAtIso
      }

      if (tiktokPostType === "video") {
        if (sourceMediaItems.length !== 1) {
          toast.error("TikTok video publishing needs one video file.")
          return null
        }
        const single = sourceMediaItems[0]
        if (single.kind !== "video") {
          toast.error("TikTok video publishing requires a video file.")
          return null
        }

        if (usingRepurposeMedia) {
          body.mediaUrl = single.url
        } else {
          const file = selectedFiles[0]
          const uploaded = await uploadFileToSupabase(file, AUTOPOST_MEDIA_FOLDER)
          if (!uploaded) {
            return null
          }
          body.mediaUrl = uploaded.url
        }
      } else {
        if (sourceMediaItems.length === 0 || sourceMediaItems.length > 35) {
          toast.error("TikTok photo posts need between 1 and 35 images.")
          return null
        }
        if (sourceMediaItems.some((item) => item.kind !== "image")) {
          toast.error("TikTok photo posts require image files only.")
          return null
        }

        let photoItems: string[] = []
        if (usingRepurposeMedia) {
          photoItems = sourceMediaItems.map((item) => item.url)
        } else {
          for (const file of selectedFiles) {
            const uploaded = await uploadFileToSupabase(file, AUTOPOST_MEDIA_FOLDER)
            if (!uploaded) {
              return null
            }
            photoItems.push(uploaded.url)
          }
        }

        body.photoItems = photoItems
        body.photoCoverIndex = Math.min(Math.max(tiktokPhotoCoverIndex, 0), photoItems.length - 1)
        if (tiktokDescription.trim()) {
          body.description = tiktokDescription.trim()
        }
      }

      if (tiktokMode === "direct") {
        body.privacyLevel = tiktokPrivacyLevel
        body.disableComment = tiktokDisableComment
        if (tiktokPostType === "video") {
          body.disableDuet = tiktokDisableDuet
          body.disableStitch = tiktokDisableStitch
        } else {
          body.autoAddMusic = tiktokAutoAddMusic
        }
      }

      const draftResponse = await fetch("/api/autopost/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const draftData = (await draftResponse.json()) as { error?: string; draft?: { id: string } }
      if (!draftResponse.ok) {
        throw new Error(draftData.error || "Failed to save TikTok draft.")
      }
      const jobId = draftData.draft?.id
      if (!jobId) {
        throw new Error("Draft saved but missing job id.")
      }
      return {
        jobId,
        mediaType:
          tiktokPostType === "photo"
            ? tiktokMode === "direct"
              ? "tiktok_photo_direct"
              : "tiktok_photo_upload"
            : tiktokMode === "direct"
              ? "tiktok_video_direct"
              : "tiktok_video_upload",
      }
    }

    if (!status?.instagram?.connected) {
      toast.error("Connect Instagram before publishing.")
      return null
    }

    if (!selectedComposerConnectionId) {
      toast.error("Select an Instagram account for this post.")
      return null
    }

    const apiMediaType = postFormatToApiMediaType(postFormat)

    if (postFormat === "carousel") {
      if (sourceMediaItems.length < 2 || sourceMediaItems.length > 10) {
        toast.error("Carousel needs between 2 and 10 images or videos.")
        return null
      }
    } else if (sourceMediaItems.length !== 1) {
      toast.error("Select a single file for this post type.")
      return null
    }

    const single = sourceMediaItems[0]
    const singleKind = single?.kind ?? null
    if (!singleKind) {
      toast.error("Unsupported media type.")
      return null
    }

    if (postFormat === "feed_image" && singleKind !== "image") {
      toast.error("Feed photo requires an image file.")
      return null
    }
    if (postFormat === "feed_video" && singleKind !== "video") {
      toast.error("Feed video requires a video file.")
      return null
    }
    if (postFormat === "reel" && singleKind !== "video") {
      toast.error("Reels require a video file.")
      return null
    }
    if (postFormat === "story" && singleKind !== "image" && singleKind !== "video") {
      toast.error("Story requires an image or video.")
      return null
    }

    const body: Record<string, unknown> = {
      caption,
      mediaType: apiMediaType,
      instagramConnectionId: selectedComposerConnectionId,
    }
    if (scheduledAtIso) {
      body.scheduledAt = scheduledAtIso
    }

    if (postFormat === "carousel") {
      if (usingRepurposeMedia) {
        body.carouselItems = sourceMediaItems.map((item) => ({
          url: item.url,
          kind: item.kind,
        }))
      } else {
        const carouselItems: { url: string; kind: "image" | "video" }[] = []
        for (const file of selectedFiles) {
          const k = inferFileKind(file)
          if (!k) {
            toast.error("Unsupported file in carousel.")
            return null
          }
          let fileToUpload = file
          if (k === "image") {
            try {
              fileToUpload = await ensureJpegForInstagramFeed(file)
            } catch (conversionError) {
              toast.error(
                conversionError instanceof Error ? conversionError.message : "Could not convert image to JPEG."
              )
              return null
            }
          }
          const uploaded = await uploadFileToSupabase(fileToUpload, AUTOPOST_MEDIA_FOLDER)
          if (!uploaded) {
            return null
          }
          carouselItems.push({ url: uploaded.url, kind: k })
        }
        body.carouselItems = carouselItems
      }
    } else {
      if (usingRepurposeMedia) {
        if (postFormat === "feed_image" && !isJpegBackedUrl(single.url)) {
          toast.error("Instagram feed photos need a JPEG-backed media URL. Upload a JPEG or switch to Story.")
          return null
        }
        body.mediaUrl = single.url
      } else {
        let fileToUpload: File = selectedFiles[0]
        if (singleKind === "image") {
          try {
            fileToUpload = await ensureJpegForInstagramFeed(selectedFiles[0])
          } catch (conversionError) {
            toast.error(
              conversionError instanceof Error ? conversionError.message : "Could not convert image to JPEG."
            )
            return null
          }
        }
        const uploaded = await uploadFileToSupabase(fileToUpload, AUTOPOST_MEDIA_FOLDER)
        if (!uploaded) {
          return null
        }
        body.mediaUrl = uploaded.url
      }
      if (postFormat === "story") {
        body.assetKind = singleKind
      }
      if (postFormat === "reel") {
        if (!shareReelToFeed) {
          body.shareToFeed = false
        }
        const cover = reelCoverUrl.trim()
        if (cover) {
          body.coverUrl = cover
        }
      }
    }

    const draftResponse = await fetch("/api/autopost/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const draftData = (await draftResponse.json()) as { error?: string; draft?: { id: string } }

    if (!draftResponse.ok) {
      throw new Error(draftData.error || "Failed to save draft.")
    }

    const jobId = draftData.draft?.id
    if (!jobId) {
      throw new Error("Draft saved but missing job id.")
    }

    return { jobId, mediaType: apiMediaType }
  }

  const handlePublishNow = async () => {
    setIsPostingDraft(true)
    try {
      const result = await uploadAndCreateDraft(null)
      if (!result) {
        return
      }

      const { jobId, mediaType } = result

      if (String(mediaType).startsWith("tiktok_")) {
        toast.message("Sending to TikTok...", {
          description:
            mediaType === "tiktok_video_upload" || mediaType === "tiktok_photo_upload"
              ? "TikTok will notify the account to finish this draft in-app."
              : "TikTok will process this Direct Post asynchronously.",
        })
      } else if (mediaType === "reel" || mediaType === "feed_video" || mediaType === "carousel") {
        toast.message("Publishing...", {
          description: "Instagram may take a few minutes to process video or multi-slide posts.",
        })
      }

      const publishResponse = await fetch("/api/autopost/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      })

      const publishData = (await publishResponse.json()) as { error?: string; provider?: string }

      if (!publishResponse.ok) {
        throw new Error(publishData.error || "Publishing failed.")
      }

      let moveWarning: string | null = null
      try {
        await finalizeRepurposeMoveIfNeeded()
      } catch (error) {
        moveWarning = error instanceof Error ? error.message : "Repurpose succeeded, but the original draft could not be removed."
      }
      toast.success(
        publishData.provider === "tiktok"
          ? tiktokMode === "upload"
            ? "Sent to TikTok inbox."
            : tiktokPostType === "photo"
              ? "TikTok photo post submitted."
              : "TikTok Direct Post submitted."
          : "Published to Instagram."
      )
      if (moveWarning) {
        toast.message(moveWarning)
      }
      resetComposer()
      setComposerOpen(false)
      void fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed")
    } finally {
      setIsPostingDraft(false)
    }
  }

  const handleSchedulePost = async () => {
    if (!Number.isFinite(scheduleDate.getTime())) {
      toast.error("Pick a valid date and time.")
      return
    }
    if (scheduleDate.getTime() <= Date.now() + 2 * 60 * 1000) {
      toast.error("Schedule at least 2 minutes from now.")
      return
    }

    setIsPostingDraft(true)
    try {
      const result = await uploadAndCreateDraft(scheduleDate.toISOString())
      if (!result) {
        return
      }

      let moveWarning: string | null = null
      try {
        await finalizeRepurposeMoveIfNeeded()
      } catch (error) {
        moveWarning = error instanceof Error ? error.message : "Repurpose succeeded, but the original draft could not be removed."
      }
      toast.success(
        composerProvider === "tiktok"
          ? "TikTok post scheduled. It will submit automatically when due."
          : "Post scheduled. It will publish automatically when due."
      )
      if (moveWarning) {
        toast.message(moveWarning)
      }
      resetComposer()
      setComposerOpen(false)
      void fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Schedule failed")
    } finally {
      setIsPostingDraft(false)
    }
  }

  const handlePublishJobFromList = async (job: AutopostJobRow) => {
    setActionJobId(job.id)
    try {
      if (job.provider === "tiktok") {
        toast.message("Sending to TikTok...", {
          description: "TikTok will process this request asynchronously.",
        })
      } else if (job.media_type === "reel" || job.media_type === "feed_video" || job.media_type === "carousel") {
        toast.message("Publishing...", {
          description: "Instagram may take a few minutes to process video or multi-slide posts.",
        })
      }
      const body =
        job.status === "queued"
          ? { jobId: job.id, publishNow: true as const }
          : { jobId: job.id }
      const publishResponse = await fetch("/api/autopost/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const publishData = (await publishResponse.json()) as { error?: string }
      if (!publishResponse.ok) {
        throw new Error(publishData.error || "Publishing failed.")
      }
      toast.success(job.provider === "tiktok" ? "TikTok request submitted." : "Published to Instagram.")
      void fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed")
    } finally {
      setActionJobId(null)
    }
  }

  const handleCancelJob = async (jobId: string) => {
    setActionJobId(jobId)
    try {
      const response = await fetch(`/api/autopost/jobs/${jobId}`, { method: "DELETE" })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Could not cancel.")
      }
      toast.success("Post cancelled.")
      void fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancel failed")
    } finally {
      setActionJobId(null)
    }
  }

  const handleRemoveGallerySlide = async (slideIndex: number) => {
    if (!activeViewerJob) {
      return
    }
    const { job } = activeViewerJob
    setGalleryRemovalIndex(slideIndex)
    try {
      const response = await fetch(`/api/autopost/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeSlideAt: slideIndex }),
      })
      const data = (await response.json()) as {
        error?: string
        metadata?: AutopostJobMetadata
        media_url?: string
      }
      if (!response.ok) {
        throw new Error(data.error || "Could not remove slide.")
      }
      toast.success("Slide removed.")
      setActiveViewerJob((current) => {
        if (!current || current.job.id !== job.id) {
          return current
        }
        const nextJob: AutopostJobRow = {
          ...current.job,
          metadata: data.metadata ?? current.job.metadata,
          media_url: data.media_url ?? current.job.media_url,
        }
        return { job: nextJob, mediaItems: getJobMediaItems(nextJob) }
      })
      void fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove slide.")
    } finally {
      setGalleryRemovalIndex(null)
    }
  }

  const handleReorderGallery = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return
    }
    if (!activeViewerJob) {
      return
    }
    const { job } = activeViewerJob
    setGalleryReorderBusy(true)
    try {
      const response = await fetch(`/api/autopost/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reorderSlide: { fromIndex, toIndex },
        }),
      })
      const data = (await response.json()) as {
        error?: string
        metadata?: AutopostJobMetadata
        media_url?: string
      }
      if (!response.ok) {
        throw new Error(data.error || "Could not reorder slides.")
      }
      toast.success("Gallery order updated.")
      setActiveViewerJob((current) => {
        if (!current || current.job.id !== job.id) {
          return current
        }
        const nextJob: AutopostJobRow = {
          ...current.job,
          metadata: data.metadata ?? current.job.metadata,
          media_url: data.media_url ?? current.job.media_url,
        }
        return { job: nextJob, mediaItems: getJobMediaItems(nextJob) }
      })
      void fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reorder slides.")
      throw error instanceof Error ? error : new Error("Could not reorder slides.")
    } finally {
      setGalleryReorderBusy(false)
    }
  }

  const handleCommitViewerCaption = async (nextCaption: string) => {
    if (!activeViewerJob) {
      return
    }
    const { job } = activeViewerJob
    setCaptionSaveBusy(true)
    try {
      const response = await fetch(`/api/autopost/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: nextCaption }),
      })
      const data = (await response.json()) as {
        error?: string
        caption?: string | null
        metadata?: AutopostJobMetadata
      }
      if (!response.ok) {
        throw new Error(data.error || "Could not save caption.")
      }
      setActiveViewerJob((current) => {
        if (!current || current.job.id !== job.id) {
          return current
        }
        const resolvedCaption =
          typeof data.caption === "undefined" ? (nextCaption.length > 0 ? nextCaption : null) : data.caption
        const nextJob: AutopostJobRow = {
          ...current.job,
          caption: resolvedCaption,
          metadata: data.metadata ?? current.job.metadata,
        }
        return { job: nextJob, mediaItems: getJobMediaItems(nextJob) }
      })
      void fetchJobs()
    } catch (error) {
      throw error instanceof Error ? error : new Error("Could not save caption.")
    } finally {
      setCaptionSaveBusy(false)
    }
  }

  const handleRetryFailed = async (jobId: string) => {
    setActionJobId(jobId)
    try {
      const publishResponse = await fetch("/api/autopost/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      })
      const publishData = (await publishResponse.json()) as { error?: string }
      if (!publishResponse.ok) {
        throw new Error(publishData.error || "Retry failed.")
      }
      toast.success("Post submitted.")
      void fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed")
    } finally {
      setActionJobId(null)
    }
  }

  const handleRefreshTikTokJobStatus = async (jobId: string) => {
    setActionJobId(jobId)
    try {
      const response = await fetch("/api/tiktok/publish-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      })
      const data = (await response.json()) as { error?: string; status?: string }
      if (!response.ok) {
        throw new Error(data.error || "Could not refresh TikTok status.")
      }
      toast.success(data.status ? `TikTok status: ${statusLabel(data.status)}` : "TikTok status updated.")
      void fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh TikTok status")
    } finally {
      setActionJobId(null)
    }
  }

  const instagramConnections = status?.instagram?.connections ?? []
  const tiktokConnections = status?.tiktok?.connections ?? []
  const postsAccountFilterOptions = React.useMemo(() => {
    const opts: { value: string; label: string }[] = []
    for (const c of instagramConnections) {
      if (c.status !== "connected" || !c.instagramConnectionId) {
        continue
      }
      const label = c.instagramUsername ? `@${c.instagramUsername}` : c.displayName || "Instagram"
      opts.push({ value: c.instagramConnectionId as string, label })
    }
    for (const c of tiktokConnections) {
      if (c.status !== "connected") {
        continue
      }
      const label = c.username ? `@${c.username}` : c.displayName || "TikTok"
      opts.push({ value: c.id, label })
    }
    return opts
  }, [instagramConnections, tiktokConnections])

  const postsDisplayJobs = React.useMemo(() => {
    if (!postsAccountFilterId) {
      return jobs
    }
    return jobs.filter((job) => {
      if (job.provider === "tiktok") {
        return job.social_connection_id === postsAccountFilterId
      }
      return job.instagram_connection_id === postsAccountFilterId
    })
  }, [jobs, postsAccountFilterId])

  React.useEffect(() => {
    if (postsAccountFilterId === null) {
      return
    }
    if (!postsAccountFilterOptions.some((o) => o.value === postsAccountFilterId)) {
      setPostsAccountFilterId(null)
    }
  }, [postsAccountFilterId, postsAccountFilterOptions])

  const isConnected = instagramConnections.some((connection) => connection.status === "connected")
  const selectedTikTokConnection = tiktokConnections.find((connection) => connection.id === selectedTikTokConnectionId)
  const isTikTokConnected = tiktokConnections.some((connection) => connection.status === "connected")
  const tikTokRequiredScope = tiktokMode === "direct" ? "video.publish" : "video.upload"
  const repurposeTargetsForInstagram = repurposeSource?.allowedTargets.filter((target) => target.provider === "instagram") ?? []
  const repurposeTargetsForTikTok = repurposeSource?.allowedTargets.filter((target) => target.provider === "tiktok") ?? []
  const repurposeAllowedProviders = new Set(repurposeSource?.allowedTargets.map((target) => target.provider) ?? [])
  const tiktokHasValidMedia =
    tiktokPostType === "photo"
      ? composerMediaItems.length >= 1 &&
        composerMediaItems.length <= 35 &&
        composerMediaItems.every((item) => item.kind === "image")
      : composerMediaItems.length === 1 && composerMediaItems[0]?.kind === "video"
  const tiktokReady =
    isTikTokConnected &&
    Boolean(selectedTikTokConnectionId) &&
    hasScope(selectedTikTokConnection, tikTokRequiredScope) &&
    tiktokHasValidMedia &&
    (tiktokMode === "upload" || Boolean(tiktokPrivacyLevel))

  const composerReady =
    composerProvider === "tiktok"
      ? tiktokReady
      : postFormat === "carousel"
        ? composerMediaItems.length >= 2 && composerMediaItems.length <= 10
        : composerMediaItems.length === 1

  const accountTiles = [
    ...instagramConnections.map((connection) => {
        const profile = connection.profile as InstagramSavedProfile | null
        const displayLabel = connection.instagramUsername
          ? `@${connection.instagramUsername}`
          : connection.displayName || "Instagram account"
        return {
          id: connection.id,
          provider: "instagram" as const,
          title: profile?.name?.trim() || connection.displayName || displayLabel,
          subtitle: displayLabel,
          href: connection.instagramUsername
            ? `https://www.instagram.com/${connection.instagramUsername}/`
            : null,
          avatarUrl: profile?.profile_picture_url ?? connection.avatarUrl,
          status: connection.status,
          meta:
            profile?.followers_count != null
              ? `${profile.followers_count.toLocaleString()} followers`
              : profile?.media_count != null
                ? `${profile.media_count.toLocaleString()} posts`
                : "Ready to publish",
          secondaryMeta:
            connection.accountType?.trim()
              ? connection.accountType.replace(/_/g, " ").toLowerCase()
              : "professional account",
          refreshId: connection.instagramConnectionId,
          disconnectId: connection.instagramConnectionId,
        }
    }),
    ...tiktokConnections.map((connection) => {
        const profile = connection.profile as TikTokSavedProfile | null
        const displayLabel =
          connection.displayName || connection.username || profile?.display_name || "TikTok account"
        return {
          id: connection.id,
          provider: "tiktok" as const,
          title: displayLabel,
          subtitle: connection.username ? `@${connection.username}` : "TikTok profile",
          href: null,
          avatarUrl: connection.avatarUrl ?? profile?.avatar_url,
          status: connection.status,
          meta: hasScope(connection, "video.publish") ? "Direct Post ready" : "Profile connected",
          secondaryMeta: `${connection.providerAccountId.slice(0, 12)}...`,
          refreshId: null,
          disconnectId: connection.id,
        }
    }),
  ]

  const missingProviders = (["instagram", "tiktok"] as const).filter((provider) =>
    provider === "instagram" ? instagramConnections.length === 0 : tiktokConnections.length === 0,
  )
  const connectedAccountCount = accountTiles.filter((tile) => tile.status === "connected").length

  const activeViewerActions: AutopostViewerAction[] = (() => {
    if (!activeViewerJob) {
      return []
    }

    const { job } = activeViewerJob
    const busy = actionJobId === job.id
    const canPublishThisJob = job.provider === "tiktok" ? isTikTokConnected : isConnected
    const actions: AutopostViewerAction[] = [
      {
        id: "repurpose",
        label: "Repurpose",
        icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
        variant: "outline",
        disabled: getRepurposeTargets(job, instagramConnections, tiktokConnections).length === 0,
        onClick: () => {
          openRepurposeDialog(job)
          setActiveViewerJob(null)
        },
      },
    ]

    if (job.status === "queued") {
      actions.push({
        id: "publish",
        label: "Publish now",
        variant: "default",
        disabled: busy || !canPublishThisJob,
        onClick: () => {
          setActiveViewerJob(null)
          void handlePublishJobFromList(job)
        },
      })
    }

    if (job.status === "draft") {
      actions.push({
        id: "publish",
        label: "Publish",
        variant: "default",
        disabled: busy || !canPublishThisJob,
        onClick: () => {
          setActiveViewerJob(null)
          void handlePublishJobFromList(job)
        },
      })
    }

    if (job.status === "failed") {
      actions.push({
        id: "retry",
        label: "Retry",
        variant: "secondary",
        disabled: busy || (job.provider === "tiktok" ? !isTikTokConnected : !isConnected),
        onClick: () => {
          setActiveViewerJob(null)
          void handleRetryFailed(job.id)
        },
      })
    }

    if (job.provider === "tiktok" && job.status === "processing") {
      actions.push({
        id: "refresh",
        label: "Refresh status",
        variant: "outline",
        disabled: busy,
        onClick: () => {
          setActiveViewerJob(null)
          void handleRefreshTikTokJobStatus(job.id)
        },
      })
    }

    return actions
  })()

  const getJobMediaPreviewForCalendar = React.useCallback((job: AutopostJobRow) => {
    const items = getJobMediaItems(job)
    const first = items[0]
    return first ? { url: first.url, kind: first.kind } : null
  }, [])

  return (
    <div className="min-h-screen bg-background px-4 pb-8 pt-20 md:pt-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3 pr-0 md:pr-10">
            <h1 className="text-3xl font-semibold tracking-tight">Manage your posts in one place.</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Connect your accounts, create new posts, and keep track of everything from one simple page.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
            <Button type="button" className="rounded-full px-4" onClick={() => setComposerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Post
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="rounded-full px-4">
                  <span className="relative mr-2 flex h-4 w-4 items-center justify-center">
                    <BrandIcon
                      provider="instagram"
                      className={cn(
                        "absolute h-4 w-4 transition-all duration-500",
                        connectIconProvider === "instagram"
                          ? "rotate-0 scale-100 opacity-100"
                          : "-rotate-90 scale-75 opacity-0",
                      )}
                    />
                    <BrandIcon
                      provider="tiktok"
                      className={cn(
                        "absolute h-4 w-4 transition-all duration-500",
                        connectIconProvider === "tiktok"
                          ? "rotate-0 scale-100 opacity-100"
                          : "rotate-90 scale-75 opacity-0",
                      )}
                    />
                  </span>
                  Connect
                  <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onSelect={handleConnectInstagram}>
                  <BrandIcon provider="instagram" className="h-4 w-4" />
                  <div className="space-y-0.5">
                    <p className="font-medium">Instagram</p>
                    <p className="text-xs text-muted-foreground">Connect a professional account</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleConnectTikTok}>
                  <BrandIcon provider="tiktok" className="h-4 w-4" />
                  <div className="space-y-0.5">
                    <p className="font-medium">TikTok</p>
                    <p className="text-xs text-muted-foreground">Connect a TikTok publishing profile</p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">Accounts</h2>
              <p className="text-sm text-muted-foreground">
                {connectedAccountCount > 0
                  ? `${connectedAccountCount} account${connectedAccountCount === 1 ? "" : "s"} connected`
                  : "Connect Instagram or TikTok to get started"}
              </p>
            </div>
            <Badge variant={connectedAccountCount > 0 ? "secondary" : "outline"} className="rounded-full px-3 py-1">
              {accountTiles.length} accounts
            </Badge>
          </div>

          {isLoadingStatus ? (
            <div className="flex items-center gap-2 rounded-[32px] border border-border/60 bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading accounts...
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {accountTiles.map((tile) => (
                <article
                  key={tile.id}
                  className="flex aspect-square w-[198px] shrink-0 flex-col rounded-[30px] border border-border/70 bg-background/90 p-4 shadow-sm transition-colors duration-200 hover:border-border"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-foreground">
                      <BrandIcon provider={tile.provider} className="h-3.5 w-3.5" />
                      {providerLabel(tile.provider)}
                    </span>
                    {tile.status === "connected" ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
                    ) : (
                      <Badge variant="outline" className="px-2 py-0.5 text-[10px]">
                        {statusLabel(tile.status)}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-3 pt-4">
                    {tile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote social avatar URLs
                      <img
                        src={tile.avatarUrl}
                        alt=""
                        className="h-16 w-16 rounded-[20px] border border-border/70 object-cover shadow-sm"
                        width={56}
                        height={56}
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-border/70 bg-muted/40">
                        <UserRound className="h-6 w-6 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <p className="line-clamp-2 text-[15px] font-semibold leading-tight text-foreground">{tile.title}</p>
                      {tile.href ? (
                        <a
                          href={tile.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs text-sky-400 underline-offset-4 hover:underline"
                        >
                          {tile.subtitle}
                        </a>
                      ) : (
                        <p className="truncate text-xs text-muted-foreground">{tile.subtitle}</p>
                      )}
                      <p className="pt-1 text-[11px] text-foreground/85">{tile.meta}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{tile.secondaryMeta}</p>
                    </div>
                  </div>

                  <div className="mt-auto space-y-2">
                    <div className={cn("grid gap-2", tile.refreshId ? "grid-cols-2" : "grid-cols-1")}>
                      {tile.refreshId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-9 rounded-full px-3"
                          disabled={refreshingConnectionId === tile.refreshId}
                          onClick={() => tile.refreshId ? void handleRefreshProfile(tile.refreshId) : undefined}
                        >
                          <RefreshCw
                            className={cn("mr-1.5 h-3.5 w-3.5", refreshingConnectionId === tile.refreshId && "animate-spin")}
                          />
                          Refresh
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-full px-3"
                        disabled={isDisconnecting || !tile.disconnectId}
                        onClick={() =>
                          tile.disconnectId
                            ? setDisconnectTarget({
                                provider: tile.provider,
                                connectionId: tile.disconnectId,
                                label: tile.subtitle,
                              })
                            : undefined
                        }
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </article>
              ))}

              {missingProviders.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  className="flex aspect-square w-[198px] shrink-0 flex-col justify-between rounded-[30px] border border-dashed border-border/70 bg-muted/10 p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/20"
                  onClick={provider === "instagram" ? handleConnectInstagram : handleConnectTikTok}
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-background shadow-sm">
                    <BrandIcon provider={provider} className="h-5 w-5" />
                  </span>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">Connect {providerLabel(provider)}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Add {providerLabel(provider)} so it appears here and can be used in the composer.
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {composerOpen ? (
          <div
            className="fixed inset-0 z-50 bg-background/80 p-4 backdrop-blur-sm"
            onClick={() => setComposerOpen(false)}
          >
            <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center">
              <Card
                className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[32px] border border-border/80 py-4 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <CardHeader className="shrink-0 border-b border-border/60 px-6 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        Draft Composer
                      </CardTitle>
                      <CardDescription>
                        Choose where to post, add your media, and publish now or schedule it for later.
                      </CardDescription>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setComposerOpen(false)}>
                      Close
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 overflow-y-auto px-6 pb-2">
              {repurposeSource ? (
                <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Repurpose</p>
                      <p className="text-sm font-medium text-foreground">
                        Using saved media from {repurposeSource.sourceLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {repurposeSource.intent === "move"
                          ? "The original will be removed after the new post is created successfully."
                          : "This stays linked to the existing uploaded media until you replace it."}
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={resetComposer}>
                      Clear
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="autopost-provider">Platform</Label>
                <Select
                  value={composerProvider}
                  onValueChange={handleComposerProviderChange}
                >
                  <SelectTrigger id="autopost-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-120">
                    <SelectItem value="instagram" disabled={repurposeSource ? !repurposeAllowedProviders.has("instagram") : false}>
                      Instagram
                    </SelectItem>
                    <SelectItem value="tiktok" disabled={repurposeSource ? !repurposeAllowedProviders.has("tiktok") : false}>
                      TikTok
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {composerProvider === "tiktok" ? (
                <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <Label htmlFor="autopost-tiktok-account">TikTok account</Label>
                  <Select
                    value={selectedTikTokConnectionId ?? undefined}
                    onValueChange={setSelectedTikTokConnectionId}
                    disabled={!isTikTokConnected}
                  >
                    <SelectTrigger id="autopost-tiktok-account" className="w-full">
                      <SelectValue placeholder={isTikTokConnected ? "Select account" : "Connect TikTok first"} />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-120">
                      {tiktokConnections
                        .filter((connection) => connection.status === "connected")
                        .map((connection) => (
                          <SelectItem key={connection.id} value={connection.id}>
                            {connection.displayName || connection.username || "TikTok account"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="autopost-tiktok-mode">TikTok action</Label>
                      <Select value={tiktokMode} onValueChange={(value) => setTikTokMode(value as TikTokMode)}>
                        <SelectTrigger id="autopost-tiktok-mode" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-120">
                          <SelectItem value="upload">Send to inbox draft</SelectItem>
                          <SelectItem value="direct">Direct Post</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="autopost-tiktok-post-type">TikTok post type</Label>
                      <Select value={tiktokPostType} onValueChange={handleTikTokPostTypeChange}>
                        <SelectTrigger id="autopost-tiktok-post-type" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-120">
                          <SelectItem
                            value="video"
                            disabled={
                              repurposeSource
                                ? !repurposeTargetsForTikTok.some((target) => target.tiktokPostType === "video")
                                : false
                            }
                          >
                            Video
                          </SelectItem>
                          <SelectItem
                            value="photo"
                            disabled={
                              repurposeSource
                                ? !repurposeTargetsForTikTok.some((target) => target.tiktokPostType === "photo")
                                : false
                            }
                          >
                            Photo post
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Required scope</Label>
                      <div className="flex h-10 items-center">
                        <Badge
                          variant={hasScope(selectedTikTokConnection, tikTokRequiredScope) ? "default" : "outline"}
                        >
                          {tikTokRequiredScope}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {!hasScope(selectedTikTokConnection, tikTokRequiredScope) ? (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100">
                      Reconnect TikTok to approve {tiktokMode === "direct" ? "Direct Post" : "upload"} permissions.
                      <Button type="button" size="sm" className="mt-2 w-full" onClick={handleConnectTikTok}>
                        Reconnect TikTok
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {composerProvider === "instagram" ? (
              <div className="space-y-2">
                <Label htmlFor="autopost-post-type">Post type</Label>
                <Select
                  value={postFormat}
                  onValueChange={handleInstagramPostFormatChange}
                  disabled={!isConnected || instagramConnections.length === 0}
                >
                  <SelectTrigger id="autopost-post-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-120">
                    <SelectItem
                      value="feed_image"
                      disabled={
                        repurposeSource
                          ? !repurposeTargetsForInstagram.some((target) => target.postFormat === "feed_image")
                          : false
                      }
                    >
                      Feed photo
                    </SelectItem>
                    <SelectItem
                      value="feed_video"
                      disabled={
                        repurposeSource
                          ? !repurposeTargetsForInstagram.some((target) => target.postFormat === "feed_video")
                          : false
                      }
                    >
                      Feed video
                    </SelectItem>
                    <SelectItem
                      value="reel"
                      disabled={
                        repurposeSource
                          ? !repurposeTargetsForInstagram.some((target) => target.postFormat === "reel")
                          : false
                      }
                    >
                      Reel
                    </SelectItem>
                    <SelectItem
                      value="carousel"
                      disabled={
                        repurposeSource
                          ? !repurposeTargetsForInstagram.some((target) => target.postFormat === "carousel")
                          : false
                      }
                    >
                      Carousel (feed)
                    </SelectItem>
                    <SelectItem
                      value="story"
                      disabled={
                        repurposeSource
                          ? !repurposeTargetsForInstagram.some((target) => target.postFormat === "story")
                          : false
                      }
                    >
                      Story
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Reels are single videos. Carousel = up to 10 slides on the feed. Stories expire after 24h.
                </p>
              </div>
              ) : null}

              {composerProvider === "instagram" && postFormat === "reel" ? (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="autopost-reel-feed"
                    checked={shareReelToFeed}
                    onCheckedChange={(c) => setShareReelToFeed(c === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="autopost-reel-feed" className="cursor-pointer font-normal leading-snug">
                      Also show this reel on the main feed
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      When off, Meta may still surface the reel in Reels only (per Instagram rules).
                    </p>
                  </div>
                </div>
              ) : null}

              {composerProvider === "instagram" ? (
              <div className="space-y-2">
                <Label htmlFor="autopost-account">Instagram account</Label>
                <Select
                  value={selectedComposerConnectionId ?? undefined}
                  onValueChange={(value) => {
                    setSelectedComposerConnectionId(value)
                    if (typeof window !== "undefined") {
                      localStorage.setItem(AUTOPOST_COMPOSER_ACCOUNT_KEY, value)
                    }
                  }}
                  disabled={!isConnected || instagramConnections.length === 0}
                >
                  <SelectTrigger id="autopost-account" className="w-full">
                    <SelectValue placeholder={isConnected ? "Select account" : "Connect Instagram first"} />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-120">
                    {instagramConnections
                      .filter((c) => c.instagramConnectionId && c.status === "connected")
                      .map((c) => (
                      <SelectItem key={c.id} value={c.instagramConnectionId as string}>
                        {c.instagramUsername ? `@${c.instagramUsername}` : c.instagramUserId ?? "Account"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  New posts and drafts are saved for the account you pick here.
                </p>
              </div>
              ) : null}

              {composerProvider === "tiktok" && tiktokMode === "direct" ? (
                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="autopost-tiktok-privacy">Privacy</Label>
                      <p className="text-xs text-muted-foreground">
                        Loaded from TikTok creator settings before Direct Post.
                      </p>
                    </div>
                    {isLoadingTikTokCreatorInfo ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                  </div>
                  <Select
                    value={tiktokPrivacyLevel}
                    onValueChange={setTikTokPrivacyLevel}
                    disabled={isLoadingTikTokCreatorInfo}
                  >
                    <SelectTrigger id="autopost-tiktok-privacy" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-120">
                      {(tiktokCreatorInfo?.privacy_level_options?.length
                        ? tiktokCreatorInfo.privacy_level_options
                        : ["SELF_ONLY"]
                      ).map((option) => (
                        <SelectItem key={option} value={option}>
                          {privacyLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={tiktokDisableComment}
                        disabled={tiktokCreatorInfo?.comment_disabled === true}
                        onCheckedChange={(value) => setTikTokDisableComment(value === true)}
                      />
                      <span>Disable comments</span>
                    </label>
                    {tiktokPostType === "video" ? (
                      <label className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={tiktokDisableDuet}
                          disabled={tiktokCreatorInfo?.duet_disabled === true}
                          onCheckedChange={(value) => setTikTokDisableDuet(value === true)}
                        />
                        <span>Disable duet</span>
                      </label>
                    ) : (
                      <label className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={tiktokAutoAddMusic}
                          onCheckedChange={(value) => setTikTokAutoAddMusic(value === true)}
                        />
                        <span>Auto-add recommended music</span>
                      </label>
                    )}
                    {tiktokPostType === "video" ? (
                      <label className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={tiktokDisableStitch}
                          disabled={tiktokCreatorInfo?.stitch_disabled === true}
                          onCheckedChange={(value) => setTikTokDisableStitch(value === true)}
                        />
                        <span>Disable stitch</span>
                      </label>
                    ) : null}
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={tiktokIsAigc}
                        onCheckedChange={(value) => setTikTokIsAigc(value === true)}
                      />
                      <span>Label as AI-generated</span>
                    </label>
                    <label className="flex items-start gap-2 text-sm sm:col-span-2">
                      <Checkbox
                        checked={tiktokBrandOrganic}
                        onCheckedChange={(value) => setTikTokBrandOrganic(value === true)}
                      />
                      <span>Promotes my own business or brand</span>
                    </label>
                    <label className="flex items-start gap-2 text-sm sm:col-span-2">
                      <Checkbox
                        checked={tiktokBrandContent}
                        onCheckedChange={(value) => setTikTokBrandContent(value === true)}
                      />
                      <span>Paid partnership or branded content</span>
                    </label>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="autopost-media">Media</Label>
                <Input
                  key={`${composerProvider}-${postFormat}-${tiktokPostType}`}
                  id="autopost-media"
                  ref={fileInputRef}
                  type="file"
                  accept={
                    composerProvider === "tiktok"
                      ? tiktokPostType === "photo"
                        ? "image/jpeg,image/png,image/webp,image/gif"
                        : "video/mp4,video/quicktime,video/webm"
                      : "image/*,video/*"
                  }
                  multiple={
                    (composerProvider === "instagram" && postFormat === "carousel") ||
                    (composerProvider === "tiktok" && tiktokPostType === "photo")
                  }
                  className="cursor-pointer"
                  onChange={handleMediaFileChange}
                />
                <p className="text-xs text-muted-foreground">
                  {repurposeSource ? "Upload new files any time to replace the repurposed media. " : ""}
                  {composerProvider === "tiktok"
                    ? tiktokPostType === "photo"
                      ? "Select 1-35 images. Order is preserved, and TikTok will pull each public URL from your uploads."
                      : "Select one MP4, MOV, or WebM video. TikTok will pull it from the uploaded public URL."
                    : postFormat === "carousel"
                      ? "Select 2-10 images and/or videos. Order is preserved."
                      : "One image or one video depending on post type."}{" "}
                  {composerProvider === "instagram" ? (
                    <>
                      PNG/WebP/GIF are converted to JPEG where needed (
                      <span className="text-foreground/80">max 10 MB</span> upload).
                    </>
                  ) : null}
                  </p>
              </div>

              {composerProvider === "instagram" && postFormat === "reel" ? (
                <div className="space-y-2">
                  <Label htmlFor="autopost-reel-cover">Cover image URL (optional)</Label>
                  <Input
                    id="autopost-reel-cover"
                    value={reelCoverUrl}
                    onChange={(e) => setReelCoverUrl(e.target.value)}
                    placeholder="https://… (JPEG, public HTTPS)"
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use a public JPEG URL from your uploads (same storage as media).
                  </p>
                </div>
              ) : null}

              {composerMediaItems.length > 0 &&
              ((composerProvider === "instagram" && postFormat === "carousel") ||
                (composerProvider === "tiktok" && tiktokPostType === "photo")) ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {composerMediaItems.map((item, i) => {
                    const isTikTokPhotoCover = composerProvider === "tiktok" && tiktokPostType === "photo" && i === tiktokPhotoCoverIndex
                    return (
                      <div
                        key={`${item.url}-${i}`}
                        className={cn(
                          "relative aspect-square overflow-hidden rounded-md border bg-muted/30",
                          composerProvider === "tiktok" &&
                            tiktokPostType === "photo" &&
                            "cursor-pointer transition hover:border-primary/60",
                          isTikTokPhotoCover && "border-primary ring-2 ring-primary/25"
                        )}
                        onClick={() => {
                          if (composerProvider === "tiktok" && tiktokPostType === "photo") {
                            setTikTokPhotoCoverIndex(i)
                          }
                        }}
                      >
                        {item.kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="" className="h-full w-full object-cover" src={item.url} />
                        ) : item.kind === "video" ? (
                          <video className="h-full w-full object-cover" src={item.url} muted playsInline />
                        ) : null}
                        {composerProvider === "tiktok" && tiktokPostType === "photo" ? (
                          <span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                            {isTikTokPhotoCover ? "Cover" : `#${i + 1}`}
                          </span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {composerMediaItems.length === 1 &&
              composerMediaItems[0]?.kind === "image" &&
              !(composerProvider === "instagram" && postFormat === "carousel") &&
              !(composerProvider === "tiktok" && tiktokPostType === "photo") ? (
                <div className="overflow-hidden rounded-md border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Selected media preview"
                    className="max-h-48 w-full object-contain"
                    src={composerMediaItems[0].url}
                  />
                </div>
              ) : null}

              {composerMediaItems.length === 1 && composerMediaItems[0]?.kind === "video" ? (
                <div className="overflow-hidden rounded-md border bg-muted/30">
                  <video
                    className="max-h-52 w-full object-contain"
                    src={composerMediaItems[0].url}
                    muted
                    controls
                    playsInline
                    preload="metadata"
                  />
                  {composerMediaItems[0].name ? (
                    <p className="border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
                      Selected: <span className="text-foreground">{composerMediaItems[0].name}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="autopost-caption">
                  {composerProvider === "tiktok" && tiktokPostType === "photo" ? "Title" : "Caption"}
                </Label>
                <Textarea
                  id="autopost-caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder={
                    composerProvider === "tiktok"
                      ? tiktokPostType === "photo"
                        ? "Short TikTok photo title..."
                        : "TikTok title/caption..."
                      : "Write your caption..."
                  }
                  rows={5}
                  disabled={composerProvider === "instagram" && postFormat === "story"}
                />
                {composerProvider === "instagram" && postFormat === "story" ? (
                  <p className="text-xs text-muted-foreground">
                    Story captions are not supported by the Instagram publishing API; compose text in-app if needed.
                  </p>
                ) : null}
                {composerProvider === "tiktok" ? (
                  <p className="text-xs text-muted-foreground">
                    {tiktokPostType === "photo"
                      ? "TikTok photo posts support a title plus an optional description. Inbox drafts can still be edited in TikTok."
                      : "TikTok captions are sent as the video title for Direct Post. Inbox drafts can still be edited in TikTok."}
                  </p>
                ) : null}
              </div>

              {composerProvider === "tiktok" && tiktokPostType === "photo" ? (
                <div className="space-y-2">
                  <Label htmlFor="autopost-tiktok-description">Description (optional)</Label>
                  <Textarea
                    id="autopost-tiktok-description"
                    value={tiktokDescription}
                    onChange={(event) => setTikTokDescription(event.target.value)}
                    placeholder="Longer TikTok photo description..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sent to TikTok photo posts as `description`. Click a preview above to choose the cover image.
                  </p>
                </div>
              ) : null}

              <Tabs value={composerTab} onValueChange={(v) => setComposerTab(v as "now" | "schedule")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="now" className="gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    Publish now
                  </TabsTrigger>
                  <TabsTrigger value="schedule" className="gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Schedule
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="now" className="mt-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {composerProvider === "tiktok"
                      ? tiktokMode === "upload"
                        ? tiktokPostType === "photo"
                          ? "Uploads your photos and sends them to the selected TikTok account inbox."
                          : "Uploads your video and sends it to the selected TikTok account inbox."
                        : tiktokPostType === "photo"
                          ? "Submits your photo post to TikTok Direct Post with the selected privacy settings."
                          : "Submits your video to TikTok Direct Post with the selected privacy settings."
                      : "Uploads your media, then publishes to Instagram immediately."}
                  </p>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => void handlePublishNow()}
                    disabled={
                      !composerReady ||
                      isPostingDraft ||
                      (composerProvider === "instagram"
                        ? !isConnected || !selectedComposerConnectionId
                        : !isTikTokConnected || !selectedTikTokConnectionId)
                    }
                  >
                    {isPostingDraft && composerTab === "now" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Publishing…
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        {composerProvider === "tiktok"
                          ? tiktokMode === "upload"
                            ? "Send to TikTok inbox"
                            : tiktokPostType === "photo"
                              ? "Direct Post photo to TikTok"
                              : "Direct Post to TikTok"
                          : "Publish to Instagram"}
                      </>
                    )}
                  </Button>
                </TabsContent>
                <TabsContent value="schedule" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label id="autopost-schedule-label">When to post</Label>
                    <Popover open={schedulePickerOpen} onOpenChange={setSchedulePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full justify-start font-normal"
                          id="autopost-schedule-picker"
                          aria-labelledby="autopost-schedule-label"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                          <span className="truncate">{format(scheduleDate, "EEE, MMM d, yyyy 'at' h:mm a")}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="flex flex-col gap-0 sm:flex-row">
                          <Calendar
                            mode="single"
                            selected={scheduleDate}
                            onSelect={(d) => {
                              if (!d) {
                                return
                              }
                              setScheduleDate((prev) => {
                                const next = new Date(d)
                                next.setHours(prev.getHours(), prev.getMinutes(), 0, 0)
                                return next
                              })
                            }}
                            disabled={(date) => isBefore(startOfDay(date), startOfToday())}
                            defaultMonth={scheduleDate}
                          />
                          <div className="flex flex-col gap-2 border-t p-3 sm:w-[200px] sm:border-t-0 sm:border-l">
                            <p className="text-xs font-medium text-muted-foreground">Time</p>
                            <div className="flex items-center gap-2">
                              <Select
                                value={String(scheduleDate.getHours())}
                                onValueChange={(v) => {
                                  const h = Number(v)
                                  setScheduleDate((prev) => {
                                    const next = new Date(prev)
                                    next.setHours(h, prev.getMinutes(), 0, 0)
                                    return next
                                  })
                                }}
                              >
                                <SelectTrigger size="sm" className="w-[72px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent position="popper" className="z-120 max-h-48">
                                  {SCHEDULE_HOURS.map((h) => (
                                    <SelectItem key={h} value={String(h)}>
                                      {pad2(h)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-muted-foreground">:</span>
                              <Select
                                value={String(scheduleDate.getMinutes())}
                                onValueChange={(v) => {
                                  const m = Number(v)
                                  setScheduleDate((prev) => {
                                    const next = new Date(prev)
                                    next.setHours(prev.getHours(), m, 0, 0)
                                    return next
                                  })
                                }}
                              >
                                <SelectTrigger size="sm" className="w-[72px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent position="popper" className="z-120 max-h-48">
                                  {SCHEDULE_MINUTES.map((m) => (
                                    <SelectItem key={m} value={String(m)}>
                                      {pad2(m)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="mt-1 w-full"
                              onClick={() => setSchedulePickerOpen(false)}
                            >
                              Done
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Uses your local timezone. The post is picked up within about a minute after this time.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    variant="secondary"
                    onClick={() => void handleSchedulePost()}
                    disabled={
                      !composerReady ||
                      isPostingDraft ||
                      (composerProvider === "instagram"
                        ? !isConnected || !selectedComposerConnectionId
                        : !isTikTokConnected || !selectedTikTokConnectionId)
                    }
                  >
                    {isPostingDraft && composerTab === "schedule" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Scheduling…
                      </>
                    ) : (
                      <>
                        <CalendarClock className="mr-2 h-4 w-4" />
                        {composerProvider === "tiktok" ? "Schedule TikTok" : "Schedule post"}
                      </>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}

        <section className="space-y-4">
          <Card className="flex flex-col rounded-[30px] border-border/70 bg-muted/10 py-4 sm:py-5">
            <CardHeader className="shrink-0 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2">
                    <LayoutList className="h-4 w-4" />
                    Posts
                  </CardTitle>
                  <CardDescription>
                    View your drafts, scheduled posts, and published posts in one place.
                  </CardDescription>
                </div>
                {jobs.length > 0 ? (
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                    <ToggleGroup
                      type="single"
                      value={postsViewMode}
                      onValueChange={(v) => {
                        if (v === "list" || v === "calendar") {
                          setPostsViewMode(v)
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full justify-stretch sm:w-auto"
                      aria-label="Posts view"
                    >
                      <ToggleGroupItem
                        value="calendar"
                        aria-label="Calendar view"
                        className="flex-1 gap-1.5 px-3 sm:flex-initial"
                      >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        Calendar
                      </ToggleGroupItem>
                      <ToggleGroupItem value="list" aria-label="List view" className="flex-1 gap-1.5 px-3 sm:flex-initial">
                        <LayoutList className="h-3.5 w-3.5" />
                        List
                      </ToggleGroupItem>
                    </ToggleGroup>
                    {postsAccountFilterOptions.length > 0 ? (
                      <Select
                        value={postsAccountFilterId ?? "all"}
                        onValueChange={(v) => setPostsAccountFilterId(v === "all" ? null : v)}
                      >
                        <SelectTrigger className="h-9 w-full sm:w-[220px]">
                          <Globe className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <SelectValue placeholder="All accounts" />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value="all">All accounts</SelectItem>
                          {postsAccountFilterOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col px-2 sm:px-6">
              {isLoadingJobs ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading posts…
                </div>
              ) : jobs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">You have not created any posts yet.</p>
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => setComposerOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first post
                  </Button>
                </div>
              ) : postsDisplayJobs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">No posts for this account.</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setPostsAccountFilterId(null)}
                  >
                    Show all accounts
                  </Button>
                </div>
              ) : postsViewMode === "calendar" ? (
                <div className="min-h-0 flex-1 overflow-auto pr-1">
                  <AutopostPostsCalendar
                    jobs={postsDisplayJobs}
                    month={postsCalendarMonth}
                    onMonthChange={setPostsCalendarMonth}
                    onPostClick={(job) => setActiveViewerJob({ job, mediaItems: getJobMediaItems(job) })}
                    getJobMediaPreview={getJobMediaPreviewForCalendar}
                  />
                </div>
              ) : (
                <ScrollArea className="h-[min(640px,calc(100vh-16rem))] pr-3 lg:flex-1">
                  <ul className="flex flex-col gap-3">
                    {postsDisplayJobs.map((job) => {
                      const busy = actionJobId === job.id
                      const mediaItems = getJobMediaItems(job)
                      const primaryMedia = mediaItems[0]
                      const carouselCount =
                        job.media_type === "carousel"
                          ? job.metadata?.carouselItems?.length
                          : job.media_type === "tiktok_photo_upload" || job.media_type === "tiktok_photo_direct"
                            ? job.metadata?.tiktok?.photoItems?.length
                            : undefined
                      const scheduleNote = scheduledVsPublishedNote(job)
                      const canPublishThisJob = job.provider === "tiktok" ? isTikTokConnected : isConnected
                      const repurposeTargets = getRepurposeTargets(job, instagramConnections, tiktokConnections)
                      const viewerIcon = getJobViewerIcon(job)
                      return (
                        <li
                          key={job.id}
                          className="rounded-2xl border border-border/80 bg-muted/15 p-3 shadow-sm transition-colors hover:border-border md:p-4"
                        >
                          <div className="flex flex-col gap-4 md:flex-row-reverse md:items-stretch md:justify-between">
                            <button
                              type="button"
                              className="group relative w-full overflow-hidden rounded-2xl border border-border/70 bg-background text-left transition hover:border-primary/40 hover:shadow-sm md:w-[180px] lg:w-[196px]"
                              onClick={() => setActiveViewerJob({ job, mediaItems })}
                            >
                              <div className="aspect-[4/3] md:aspect-square">
                                {primaryMedia?.kind === "video" ? (
                                  <video
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                                    src={primaryMedia.url}
                                    muted
                                    playsInline
                                    preload="metadata"
                                  />
                                ) : primaryMedia ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    alt=""
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                                    src={primaryMedia.url}
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center bg-muted/40 text-muted-foreground">
                                    <ImageIcon className="h-5 w-5" />
                                  </div>
                                )}
                              </div>
                              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2">
                                <span className="rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white">
                                  {job.provider === "tiktok" ? "TikTok" : "Instagram"}
                                </span>
                                <span className="rounded-full bg-background/92 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
                                  {viewerIcon === "carousel" ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Layers className="h-3 w-3" />
                                      {carouselCount ?? mediaItems.length}
                                    </span>
                                  ) : viewerIcon === "video" ? (
                                    <Film className="h-3 w-3" />
                                  ) : viewerIcon === "story" ? (
                                    <Sparkles className="h-3 w-3" />
                                  ) : (
                                    <ImageIcon className="h-3 w-3" />
                                  )}
                                </span>
                              </div>
                            </button>
                            <div className="min-w-0 flex-1 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className="max-w-full truncate px-2.5 py-1 text-sm font-semibold tracking-tight"
                                  title={jobAccountLabel(job)}
                                >
                                  {jobAccountLabel(job)}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={cn("text-xs font-medium", statusBadgeClass(job.status))}
                                >
                                  {statusLabel(job.status)}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {mediaTypeLabel(job.media_type)}
                                {carouselCount != null && carouselCount > 0
                                  ? ` · ${carouselCount} slides`
                                  : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">{postStatusTimeLine(job)}</p>
                              {scheduleNote ? (
                                <p className="text-xs text-muted-foreground">{scheduleNote}</p>
                              ) : null}
                              {job.caption ? (
                                <p className="line-clamp-2 text-sm text-foreground">{job.caption}</p>
                              ) : (
                                <p className="text-xs italic text-muted-foreground">No caption</p>
                              )}
                              {job.status === "failed" && job.last_error ? (
                                <p className="line-clamp-2 text-xs text-destructive">{job.last_error}</p>
                              ) : null}
                              {(job.status === "published" || job.provider === "tiktok") && job.provider_publish_id ? (
                                <p className="text-[11px] text-muted-foreground">
                                  {job.provider === "tiktok" ? "Publish ID" : "Media ID"}:{" "}
                                  <span className="font-mono">{job.provider_publish_id}</span>
                                </p>
                              ) : null}
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={repurposeTargets.length === 0}
                                  onClick={() => openRepurposeDialog(job)}
                                >
                                  <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
                                  Repurpose
                                </Button>
                                {job.status === "queued" ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="default"
                                      disabled={busy || !canPublishThisJob}
                                      onClick={() => void handlePublishJobFromList(job)}
                                    >
                                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                      Publish now
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={busy}
                                      onClick={() => void handleCancelJob(job.id)}
                                    >
                                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                                      Cancel
                                    </Button>
                                  </>
                                ) : null}
                                {job.status === "draft" ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={busy || !canPublishThisJob}
                                      onClick={() => void handlePublishJobFromList(job)}
                                    >
                                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                      Publish
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={busy}
                                      onClick={() => void handleCancelJob(job.id)}
                                    >
                                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                                      Discard
                                    </Button>
                                  </>
                                ) : null}
                                {job.status === "failed" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={busy || (job.provider === "tiktok" ? !isTikTokConnected : !isConnected)}
                                    onClick={() => void handleRetryFailed(job.id)}
                                  >
                                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                    Retry
                                  </Button>
                                ) : null}
                                {job.provider === "tiktok" && job.status === "processing" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => void handleRefreshTikTokJobStatus(job.id)}
                                  >
                                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                    Refresh status
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {activeViewerJob ? (
        <AutopostPostMediaViewer
          accountLabel={jobAccountLabel(activeViewerJob.job)}
          caption={jobCaptionForViewer(activeViewerJob.job)}
          createdAt={activeViewerJob.job.created_at}
          lastError={activeViewerJob.job.status === "failed" ? activeViewerJob.job.last_error : null}
          mediaItems={activeViewerJob.mediaItems}
          mediaTypeIcon={getJobViewerIcon(activeViewerJob.job)}
          mediaTypeLabel={mediaTypeLabel(activeViewerJob.job.media_type)}
          onClose={() => setActiveViewerJob(null)}
          providerLabel={activeViewerJob.job.provider === "tiktok" ? "TikTok" : "Instagram"}
          providerPublishId={activeViewerJob.job.provider_publish_id}
          providerPublishIdLabel={activeViewerJob.job.provider === "tiktok" ? "Publish ID" : "Media ID"}
          publishedAt={activeViewerJob.job.published_at}
          scheduleNote={scheduledVsPublishedNote(activeViewerJob.job)}
          scheduledAt={activeViewerJob.job.scheduled_at}
          statusClassName={statusBadgeClass(activeViewerJob.job.status)}
          statusLabel={statusLabel(activeViewerJob.job.status)}
          timestampsLabel={postStatusTimeLine(activeViewerJob.job)}
          updatedAt={activeViewerJob.job.updated_at}
          actions={activeViewerActions}
          onDeletePost={
            activeViewerJob.job.status === "draft" || activeViewerJob.job.status === "queued"
              ? () => {
                  setActiveViewerJob(null)
                  void handleCancelJob(activeViewerJob.job.id)
                }
              : undefined
          }
          deletePostDisabled={actionJobId === activeViewerJob.job.id}
          deletePostBusy={actionJobId === activeViewerJob.job.id}
          showGalleryRemoveButtons={jobAllowsPerSlideRemoval(activeViewerJob.job)}
          onRemoveGalleryItem={
            jobAllowsPerSlideRemoval(activeViewerJob.job) ? handleRemoveGallerySlide : undefined
          }
          removingGalleryIndex={galleryRemovalIndex}
          galleryReorderable={jobAllowsGalleryReorder(activeViewerJob.job)}
          onReorderGallery={
            jobAllowsGalleryReorder(activeViewerJob.job) ? handleReorderGallery : undefined
          }
          reorderingGallery={galleryReorderBusy}
          captionEditable={jobAllowsCaptionEdit(activeViewerJob.job)}
          onCaptionCommit={
            jobAllowsCaptionEdit(activeViewerJob.job) ? handleCommitViewerCaption : undefined
          }
          captionCommitBusy={captionSaveBusy}
        />
      ) : null}

      <Dialog
        open={repurposeDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRepurposeDialog(null)
          }
        }}
      >
        {repurposeDialog ? (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Repurpose post</DialogTitle>
              <DialogDescription>
                Move or copy this post into another compatible format or account. The composer will be prefilled with the
                existing uploaded media.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Source</p>
                <p className="mt-1 text-sm font-medium text-foreground">{jobAccountLabel(repurposeDialog.job)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {mediaTypeLabel(repurposeDialog.job.media_type)} · {statusLabel(repurposeDialog.job.status)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="repurpose-target">Destination type</Label>
                <Select
                  value={repurposeDialog.selectedTargetId}
                  onValueChange={(value) => {
                    const selectedTarget = repurposeDialog.targets.find((target) => target.id === value)
                    setRepurposeDialog((current) =>
                      current
                        ? {
                            ...current,
                            selectedTargetId: value,
                            selectedAccountId: selectedTarget?.accounts[0]?.id ?? null,
                          }
                        : current,
                    )
                  }}
                >
                  <SelectTrigger id="repurpose-target" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-120">
                    {repurposeDialog.targets.map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="repurpose-account">Destination account</Label>
                <Select
                  value={
                    repurposeDialog.selectedAccountId ??
                    repurposeDialog.targets.find((target) => target.id === repurposeDialog.selectedTargetId)?.accounts[0]?.id ??
                    undefined
                  }
                  onValueChange={(value) =>
                    setRepurposeDialog((current) => (current ? { ...current, selectedAccountId: value } : current))
                  }
                >
                  <SelectTrigger id="repurpose-account" className="w-full">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-120">
                    {(repurposeDialog.targets.find((target) => target.id === repurposeDialog.selectedTargetId)?.accounts ?? []).map(
                      (account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              {!repurposeAllowsMove(repurposeDialog.job) ? (
                <p className="text-xs text-muted-foreground">
                  Move is only available for drafts and scheduled posts. Published or in-flight posts can still be copied.
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRepurposeDialog(null)}>
                Cancel
              </Button>
              <Button type="button" variant="outline" onClick={() => applyRepurposeSelection("copy")}>
                Copy into composer
              </Button>
              <Button
                type="button"
                onClick={() => applyRepurposeSelection("move")}
                disabled={!repurposeAllowsMove(repurposeDialog.job)}
              >
                Move into composer
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <AlertDialog
        open={disconnectTarget !== null}
        onOpenChange={(open) => {
          if (!open && isDisconnecting) {
            return
          }
          if (!open) {
            setDisconnectTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {disconnectTarget?.provider === "tiktok" ? "TikTok" : "Instagram"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the link to{" "}
              <span className="font-medium text-foreground">
                {disconnectTarget?.label ?? "this account"}
              </span>
              . You can connect it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDisconnect()
              }}
              disabled={isDisconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting…
                </>
              ) : (
                "Disconnect"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
