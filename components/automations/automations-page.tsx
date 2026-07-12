"use client"

import * as React from "react"
import Link from "next/link"
import { FilePlus, FolderOpen, Plus as PlusPhosphor } from "@phosphor-icons/react"
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  Clock,
  Eye,
  Globe,
  Loader2,
  Pencil,
  Play,
  Plus,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { CommandTextarea } from "@/components/commands/command-textarea"
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import { VariablesEditor } from "@/components/automations/variables-editor"
import { AUTOMATION_SLASH_COMMANDS } from "@/lib/commands/presets-automation"
import type { AttachedRef } from "@/lib/commands/types"
import { makeMentionToken } from "@/lib/commands/mention-token"
import {
  normalizeAutomationPromptPayload,
  sanitizeAutomationVariables,
  type AutomationPromptAttachment,
  type AutomationPromptPayload,
  type AutomationPromptVariable,
} from "@/lib/automations/prompt-payload"
import {
  CHAT_GATEWAY_MODEL_OPTIONS,
  DEFAULT_CHAT_GATEWAY_MODEL,
  getChatGatewayModelOption,
  normalizeChatGatewayModelSelection,
} from "@/lib/constants/chat-llm-models"
import { getDefaultTimeZone, listIanaTimeZones } from "@/lib/constants/timezones"
import {
  buildDailyCron,
  buildWeeklyCron,
  CRON_PRESET_HOURLY,
  describeCronHumanSummary,
  inferPresetFromCron,
  type InferredPreset,
} from "@/lib/automations/schedule"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Collapsible as CollapsiblePrimitive, Dialog as DialogPrimitive } from "radix-ui"
import { AutomationRunPreviewModal } from "@/components/automations/automation-run-preview-modal"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { MessageParts } from "@/components/chat/message-parts"
import type { UIMessage } from "ai"

type AutomationApi = {
  id: string
  user_id?: string
  name: string
  description?: string | null
  prompt: string
  prompt_payload?: AutomationPromptPayload | null
  cron_schedule: string
  timezone: string
  model: string | null
  is_active: boolean
  last_run_at?: string | null
  next_run_at?: string
  run_count?: number
  last_error?: string | null
  latestRun?: AutomationRunApi | null
  is_public?: boolean
  hasPreview?: boolean
  preview_captured_at?: string | null
  preview_run_id?: string | null
}

type AutomationRunApi = {
  id: string
  automation_id: string
  thread_id: string | null
  status: string
  started_at: string
  finished_at: string | null
  error: string | null
  created_at: string
  run_trigger?: "manual" | "scheduled"
}

const AUTOMATION_SHEET_DIALOG_CLASSNAME =
  "flex !bottom-auto !left-1/2 !right-auto !top-1/2 !max-w-none !w-[calc(100vw-2rem)] !-translate-x-1/2 !-translate-y-1/2 max-h-[92dvh] flex-col gap-0 overflow-x-hidden rounded-4xl px-0"

const WEEKDAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
]

const SCHEDULE_HOURS = Array.from({ length: 24 }, (_, i) => i)
const SCHEDULE_MINUTES = Array.from({ length: 60 }, (_, i) => i)

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function formatScheduleTime(hour: number, minute: number): string {
  const normalizedHour = hour % 12 || 12
  const suffix = hour >= 12 ? "PM" : "AM"
  return `${normalizedHour}:${pad2(minute)} ${suffix}`
}

function describeScheduleControlLabel(input: {
  presetTab: "presets" | "custom"
  presetKind: InferredPreset["kind"]
  dailyHour: number
  dailyMinute: number
  weeklyDow: number
  weeklyHour: number
  weeklyMinute: number
}): string {
  if (input.presetTab === "custom" || input.presetKind === "custom") {
    return "Custom schedule"
  }
  switch (input.presetKind) {
    case "hourly":
      return "Hourly"
    case "daily":
      return `Daily at ${formatScheduleTime(input.dailyHour, input.dailyMinute)}`
    case "weekly":
      return `Weekly on ${WEEKDAYS.find((day) => Number(day.value) === input.weeklyDow)?.label ?? "Day"} at ${formatScheduleTime(
        input.weeklyHour,
        input.weeklyMinute,
      )}`
    default:
      return "Schedule"
  }
}

function slugifyAutomationVariableId(name: string): string {
  const trimmed = name.trim()
  const base = trimmed.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "")
  let id = base.length > 0 ? base : "var"
  if (!/^[a-zA-Z]/.test(id)) {
    id = `v_${id}`
  }
  id = id.replace(/[^a-zA-Z0-9_-]/g, "")
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)) {
    id = "var"
  }
  return id
}

function makeNewAutomationVariable(existing: AutomationPromptVariable[]): AutomationPromptVariable {
  const label = `Variable ${existing.length + 1}`
  const base = slugifyAutomationVariableId(label)
  const taken = new Set(existing.map((variable) => variable.id))

  let id = base
  let suffix = 1
  while (taken.has(id)) {
    id = `${base}_${suffix}`
    suffix += 1
  }

  return {
    id,
    name: label,
    mode: "random",
    items: [],
  }
}

function buildAutomationDescriptionPrompt(input: {
  name: string
  scheduleSummary: string
  prompt: string
}): string {
  return [
    "Write a short automation description for a product UI.",
    "Return exactly 2 short lines.",
    "Line 1 should say what the automation does.",
    "Line 2 should mention cadence or output style.",
    "Do not use bullets, numbering, labels, quotes, markdown, or emojis.",
    "",
    `Title: ${input.name}`,
    `Schedule: ${input.scheduleSummary}`,
    "Prompt:",
    input.prompt,
  ].join("\n")
}

function normalizeAutomationDescription(text: string): string {
  const cleanedLines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean)

  if (cleanedLines.length >= 2) {
    return cleanedLines.slice(0, 2).join("\n")
  }

  const sentenceParts = cleanedLines
    .join(" ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (sentenceParts.length >= 2) {
    return sentenceParts.slice(0, 2).join("\n")
  }

  return cleanedLines.join(" ").trim()
}

function buildCronFromPreset(
  preset: InferredPreset["kind"],
  fields: {
    dailyMinute: number
    dailyHour: number
    weeklyDow: number
    weeklyMinute: number
    weeklyHour: number
    customCron: string
  },
): string {
  switch (preset) {
    case "hourly":
      return CRON_PRESET_HOURLY
    case "daily":
      return buildDailyCron(fields.dailyMinute, fields.dailyHour)
    case "weekly":
      return buildWeeklyCron(fields.weeklyDow, fields.weeklyMinute, fields.weeklyHour)
    case "custom":
      return fields.customCron.trim()
    default: {
      const _exhaustive: never = preset
      return _exhaustive
    }
  }
}

type AutomationPendingUpload = {
  file: File
  id: string
  isUploading: boolean
  uploadedUrl?: string
}

function mediaKindFromMime(mime: string): "audio" | "image" | "other" | "video" {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  return "other"
}

/** Canonical JSON for PATCH body fields — used to detect unsaved edits vs last hydrated baseline. */
function buildPersistSnapshot(input: {
  name: string
  description: string
  promptPayload: AutomationPromptPayload
  cronSchedule: string
  timezone: string
  model: string
  isPublic: boolean
}): string {
  return JSON.stringify({
    name: input.name.trim(),
    description: input.description.trim() || null,
    promptPayload: input.promptPayload,
    cronSchedule: input.cronSchedule.trim(),
    timezone: input.timezone,
    model: input.model || null,
    isPublic: input.isPublic,
  })
}

function attachedRefFromAssetPick(pick: AssetSelectionPick): AttachedRef {
  const { assetType, id, previewUrl, source, title, url } = pick
  const chipId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const label =
    title?.trim() ||
    (assetType === "image" ? "Reference image" : assetType === "video" ? "Reference video" : "Reference audio")
  return {
    id: source === "asset" && id ? `asset:${id}` : chipId,
    label,
    category: "asset",
    assetType,
    assetUrl: url,
    previewUrl: previewUrl ?? url,
    serialized: `Reference (${assetType}) "${label}": ${url}`,
    chipId,
    mentionToken: "",
  }
}

function AutomationCardMedia({
  threadId,
  automationId = null,
  isCommunity = false,
}: {
  threadId: string | null
  automationId?: string | null
  isCommunity?: boolean
}) {
  const [media, setMedia] = React.useState<{ type: "image" | "video" | "audio" | null; url: string | null }>({ type: null, url: null })
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const url = isCommunity
      ? automationId
        ? `/api/automations/${automationId}/preview`
        : null
      : threadId
        ? `/api/chat/threads/${threadId}`
        : null

    if (!url) {
      setMedia({ type: null, url: null })
      return
    }
    let cancelled = false
    setLoading(true)

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const messages = data.messages ?? data.thread?.messages
        if (Array.isArray(messages)) {
          // Scan backwards to find the latest generated media
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role !== "assistant" || !msg.parts) continue;
            
            for (const part of msg.parts) {
              if (part.type === "tool-generateImage" || part.type === "tool-generateImageWithNanoBanana") {
                const partObj = part as unknown as Record<string, unknown>;
                const output = partObj.output as Record<string, unknown> | undefined;
                if (output && output.status === "completed" && Array.isArray(output.images) && output.images.length > 0) {
                  const firstImg = output.images[0];
                  const url = typeof firstImg === "string" ? firstImg : (firstImg as Record<string, unknown>)?.url as string | undefined;
                  if (url) {
                    setMedia({ type: "image", url });
                    return;
                  }
                }
              } else if (part.type === "tool-generateVideo") {
                const partObj = part as unknown as Record<string, unknown>;
                const output = partObj.output as Record<string, unknown> | undefined;
                if (output && output.status === "completed" && (output.video as Record<string, unknown>)?.url) {
                  setMedia({ type: "video", url: (output.video as Record<string, unknown>).url as string });
                  return;
                }
              } else if (part.type === "tool-generateAudio") {
                const partObj = part as unknown as Record<string, unknown>;
                const output = partObj.output as Record<string, unknown> | undefined;
                if (output && output.status === "completed" && (output.audio as Record<string, unknown>)?.url) {
                  setMedia({ type: "audio", url: (output.audio as Record<string, unknown>).url as string });
                  return;
                }
              }
            }
          }
        }
        setMedia({ type: null, url: null })
      })
      .catch(() => {
        if (!cancelled) setMedia({ type: null, url: null })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [threadId, automationId, isCommunity])

  if (loading) {
    return <div className="h-full w-full animate-pulse bg-muted/40" />
  }

  if (media.url) {
    if (media.type === "video") {
      return (
        <div className="relative h-full w-full">
          <video src={media.url} muted playsInline className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="h-8 w-8 text-white fill-white/80 opacity-80" />
          </div>
        </div>
      )
    }
    return <img src={media.url} alt="" className="h-full w-full object-cover" />
  }

  // Fallback gradient placeholder
  return (
    <div className="h-full w-full bg-gradient-to-br from-primary/10 via-muted/30 to-background flex items-center justify-center">
      <CalendarClock className="h-8 w-8 text-muted-foreground/30" />
    </div>
  )
}

function AutomationPreviewTab({
  threadId: initialThreadId,
  automationId,
  isCommunity,
  hasPreview,
  activeRunId = null,
  runTrigger = "scheduled",
}: {
  threadId: string | null
  automationId: string
  isCommunity: boolean
  hasPreview: boolean
  activeRunId?: string | null
  runTrigger?: "manual" | "scheduled"
}) {
  const [runStatus, setRunStatus] = React.useState<"running" | "completed" | "failed" | null>(
    activeRunId ? "running" : "completed"
  )
  const [threadId, setThreadId] = React.useState<string | null>(initialThreadId)
  const [runError, setRunError] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<UIMessage[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pollExhausted, setPollExhausted] = React.useState(false)

  // Reset state when inputs change
  React.useEffect(() => {
    setRunStatus(activeRunId ? "running" : "completed")
    setThreadId(initialThreadId)
    setRunError(null)
    setMessages([])
    setError(null)
    setPollExhausted(false)
  }, [activeRunId, initialThreadId, automationId, isCommunity])

  React.useEffect(() => {
    let cancelled = false
    let pollCount = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const ac = new AbortController()

    const loadMessagesForThread = async (tid: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/chat/threads/${tid}`, { signal: ac.signal })
        const j = (await res.json().catch(() => ({}))) as { thread?: { messages?: UIMessage[] }; error?: string }
        if (!res.ok) {
          throw new Error(typeof j?.error === "string" ? j.error : "Failed to load thread")
        }
        if (cancelled) return
        const msgs = Array.isArray(j.thread?.messages) ? j.thread.messages : []
        setMessages(msgs)
      } catch (e) {
        if (cancelled || (e instanceof Error && e.name === "AbortError")) return
        setError(e instanceof Error ? e.message : "Failed to load messages")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const loadCommunityPreview = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/automations/${automationId}/preview`, { signal: ac.signal })
        const j = (await res.json().catch(() => ({}))) as { messages?: UIMessage[]; error?: string }
        if (cancelled) return
        if (!res.ok) {
          setError(typeof j?.error === "string" ? j.error : "Failed to load preview")
          return
        }
        const msgs = Array.isArray(j.messages) ? j.messages : []
        setMessages(msgs)
      } catch (e) {
        if (cancelled || (e instanceof Error && e.name === "AbortError")) return
        setError(e instanceof Error ? e.message : "Failed to load preview")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const pollOnce = async (): Promise<boolean> => {
      if (!activeRunId) return false
      try {
        const res = await fetch(`/api/automations/${automationId}/runs/${activeRunId}`, { signal: ac.signal })
        const j = (await res.json().catch(() => ({}))) as { run?: AutomationRunApi; error?: string }
        if (cancelled) return false
        if (!res.ok) {
          setError(typeof j?.error === "string" ? j.error : "Failed to load run status")
          return false
        }
        const row = j.run
        if (!row) {
          setError("Run not found")
          return false
        }
        setRunStatus(row.status)
        setThreadId(row.thread_id)
        setRunError(row.error)

        if (row.status === "completed" && row.thread_id) {
          await loadMessagesForThread(row.thread_id)
          return false
        }
        if (row.status === "failed") {
          return false
        }
        return row.status === "running"
      } catch (e) {
        if (cancelled) return false
        return true
      }
    }

    void (async () => {
      if (isCommunity) {
        await loadCommunityPreview()
        return
      }

      if (activeRunId) {
        const keepPolling = await pollOnce()
        if (!keepPolling || cancelled) return

        const schedule = () => {
          if (cancelled) return
          pollCount += 1
          if (pollCount > 200) {
            setPollExhausted(true)
            return
          }
          timer = setTimeout(async () => {
            const cont = await pollOnce()
            if (cont && !cancelled) schedule()
          }, 1500)
        }
        schedule()
      } else if (initialThreadId) {
        await loadMessagesForThread(initialThreadId)
      }
    })()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      ac.abort()
    }
  }, [activeRunId, initialThreadId, automationId, isCommunity])

  if (isCommunity && !hasPreview) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <CalendarClock className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">No preview available yet</p>
        <p className="mt-1 text-xs max-w-sm">This community automation hasn&apos;t shared a sample run.</p>
      </div>
    )
  }

  if (!isCommunity && !activeRunId && !initialThreadId) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <CalendarClock className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">No run output available yet</p>
        <p className="mt-1 text-xs max-w-sm">Trigger a run using the &quot;Run now&quot; button in the header to generate media.</p>
      </div>
    )
  }

  const showRunningUi = runStatus === "running" && !pollExhausted
  const showTranscript = runStatus === "completed" && messages.length > 0
  const assistantMessages = messages.filter((m) => m.role === "assistant")

  return (
    <div className="space-y-6 p-5 sm:p-6 overflow-y-auto h-full max-h-full">
      {pollExhausted && (
        <p className="text-sm text-muted-foreground">
          Still running, open the thread from Recent runs when it finishes, or try again later.
        </p>
      )}

      {showRunningUi && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Automation is running…</span>
          </div>
          <Shimmer className="text-sm">Waiting for assistant response…</Shimmer>
        </div>
      )}

      {runStatus === "failed" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {runError || "Run failed"}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {loading && runStatus === "completed" && messages.length === 0 && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading transcript…
        </div>
      )}

      {showTranscript && assistantMessages.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-muted/10 p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/30">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated Output</h3>
            {threadId && !isCommunity && (
              <Link
                href={`/chat/${threadId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary hover:underline"
              >
                Open full thread
              </Link>
            )}
          </div>
          <div className="space-y-6">
            {assistantMessages.map((msg) => (
              <div key={msg.id} className="space-y-4">
                <MessageParts
                  message={msg}
                  instagramConnectionsById={new Map()}
                  onToolApprovalResponse={() => {}}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {runStatus === "completed" && !loading && messages.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">No messages generated in this run yet.</p>
      )}
    </div>
  )
}

function AutomationHistoryTab({
  runs,
  loadingRuns,
  automation,
}: {
  runs: AutomationRunApi[]
  loadingRuns: boolean
  automation: AutomationApi
}) {
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null)
  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? runs[0] ?? null

  React.useEffect(() => {
    if (runs.length > 0 && !selectedRunId) {
      setSelectedRunId(runs[0].id)
    }
  }, [runs, selectedRunId])

  if (loadingRuns) {
    return (
      <div className="flex h-full min-h-[350px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="flex h-full min-h-[350px] flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <p className="text-sm font-medium">No runs recorded yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 md:divide-x divide-border/50">
      {/* Sidebar list of runs (desktop only) */}
      <div className="hidden md:block w-[260px] shrink-0 overflow-y-auto p-4 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-3">Past Runs</h3>
        <div className="space-y-1.5">
          {runs.map((r) => {
            const isActive = selectedRun?.id === r.id
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRunId(r.id)}
                className={cn(
                  "w-full text-left rounded-xl border p-3 transition-colors flex flex-col gap-1.5",
                  isActive
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : "border-border/50 bg-card hover:bg-muted/30"
                )}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <Badge
                    variant={
                      r.status === "completed"
                        ? "default"
                        : r.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-[9px] h-4 px-1"
                  >
                    {r.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(r.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                  <span>{new Date(r.started_at).toLocaleDateString()}</span>
                  <span className="capitalize">{r.run_trigger ?? "Scheduled"}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main preview for selected run */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile run selector */}
        <div className="md:hidden p-4 border-b border-border/40 bg-muted/10 shrink-0">
          <Select
            value={selectedRunId ?? undefined}
            onValueChange={(val) => setSelectedRunId(val)}
          >
            <SelectTrigger className="w-full bg-background border-border/50 h-9 text-xs">
              <SelectValue placeholder="Select a run to view" />
            </SelectTrigger>
            <SelectContent>
              {runs.map((r) => {
                const date = new Date(r.started_at)
                const dateStr = date.toLocaleDateString()
                const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                const statusStr = r.status.toUpperCase()
                const triggerStr = r.run_trigger === "manual" ? "Manual" : "Scheduled"
                return (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    {dateStr} {timeStr} — {statusStr} ({triggerStr})
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {selectedRun ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/30 px-2">
                <div>
                  <h4 className="text-sm font-semibold">Run Details</h4>
                  <p className="text-xs text-muted-foreground">Started on {new Date(selectedRun.started_at).toLocaleString()}</p>
                </div>
                {selectedRun.thread_id && (
                  <Link
                    href={`/chat/${selectedRun.thread_id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Open full thread
                  </Link>
                )}
              </div>
              
              {selectedRun.error && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive mx-2">
                  {selectedRun.error}
                </div>
              )}
              
              <AutomationPreviewTab
                threadId={selectedRun.thread_id}
                automationId={automation.id}
                isCommunity={false}
                hasPreview={false}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function AutomationTabNav({
  activeTab,
  onSelect,
  variant,
  isCommunity,
}: {
  activeTab: "preview" | "history" | "edit"
  onSelect: (tab: "preview" | "history" | "edit") => void
  variant: "sidebar" | "scroll"
  isCommunity: boolean
}) {
  const tabs = [
    { id: "preview" as const, label: "Preview", icon: Eye },
    ...(!isCommunity ? [{ id: "history" as const, label: "History", icon: Clock }] : []),
    { id: "edit" as const, label: isCommunity ? "Setup Details" : "Edit Setup", icon: Pencil },
  ]

  return (
    <nav
      className={cn(
        variant === "sidebar" && "flex flex-col gap-0.5",
        variant === "scroll" &&
          "flex gap-1 overflow-x-auto overscroll-x-contain px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      )}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = id === activeTab
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors text-left",
              isActive
                ? "bg-muted/80 text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              variant === "sidebar" ? "w-full" : undefined
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function AutomationsPage() {
  const [scope, setScope] = React.useState<"mine" | "community">("mine")
  const [userId, setUserId] = React.useState<string | null>(null)
  const [loadingAuth, setLoadingAuth] = React.useState(true)
  const [loadingList, setLoadingList] = React.useState(true)
  const [automations, setAutomations] = React.useState<AutomationApi[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [newDialogOpen, setNewDialogOpen] = React.useState(false)
  const [automationDetailsOpen, setAutomationDetailsOpen] = React.useState(false)
  const [recentRunsOpen, setRecentRunsOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"preview" | "history" | "edit">("preview")
  const [runs, setRuns] = React.useState<AutomationRunApi[]>([])
  const [loadingRuns, setLoadingRuns] = React.useState(false)
  const [editDetailsOpen, setEditDetailsOpen] = React.useState(false)
  const [unsavedCloseConfirmOpen, setUnsavedCloseConfirmOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  /** When switching from summary → editor (mine), closing details must not clear `editDetailsOpen`. */
  const skipResetEditOnDetailsCloseRef = React.useRef(false)

  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [prompt, setPrompt] = React.useState("")
  const [attachedRefs, setAttachedRefs] = React.useState<AttachedRef[]>([])
  const [savedAttachments, setSavedAttachments] = React.useState<AutomationPromptAttachment[]>([])
  const [uploadQueue, setUploadQueue] = React.useState<AutomationPendingUpload[]>([])
  const [automationVariables, setAutomationVariables] = React.useState<AutomationPromptVariable[]>([])
  const [assetPickerForVariable, setAssetPickerForVariable] = React.useState<{
    variableId: string
    itemIndex: number
  } | null>(null)
  const [assetModalOpen, setAssetModalOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [timezone, setTimezone] = React.useState(() => getDefaultTimeZone())
  const ianaZones = React.useMemo(() => listIanaTimeZones(), [])
  const [model, setModel] = React.useState<string>(DEFAULT_CHAT_GATEWAY_MODEL)
  const [presetTab, setPresetTab] = React.useState<"presets" | "custom">("presets")
  const [presetKind, setPresetKind] = React.useState<InferredPreset["kind"]>("daily")
  const [dailyHour, setDailyHour] = React.useState(9)
  const [dailyMinute, setDailyMinute] = React.useState(0)
  const [weeklyDow, setWeeklyDow] = React.useState(1)
  const [weeklyHour, setWeeklyHour] = React.useState(9)
  const [weeklyMinute, setWeeklyMinute] = React.useState(0)
  const [customCron, setCustomCron] = React.useState(CRON_PRESET_HOURLY)
  const [nextPreview, setNextPreview] = React.useState<string | null>(null)
  const [variablesDialogOpen, setVariablesDialogOpen] = React.useState(false)
  const [editBaselineSnapshot, setEditBaselineSnapshot] = React.useState("")
  const needsEditBaselineCaptureRef = React.useRef(false)
  const [runningId, setRunningId] = React.useState<string | null>(null)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [isPublicAutomation, setIsPublicAutomation] = React.useState(false)
  const [cloningId, setCloningId] = React.useState<string | null>(null)
  const [settingPreviewRunId, setSettingPreviewRunId] = React.useState<string | null>(null)

  const [pendingManualRunPreview, setPendingManualRunPreview] = React.useState<{
    automationId: string
    runId: string
    threadId: string | null
    status: "completed" | "failed"
    error: string | null
  } | null>(null)
  const [activeRunInfo, setActiveRunInfo] = React.useState<{
    automationId: string
    runId: string
    threadId: string | null
  } | null>(null)

  const selected = automations.find((a) => a.id === selectedId) ?? null
  const isCommunityScope = scope === "community"
  const lastHydratedId = React.useRef<string | null>(null)
  const autoOpenedRunIdRef = React.useRef<string | null>(null)
  const selectedAssetRefs = React.useMemo(
    () =>
      attachedRefs.filter(
        (ref) =>
          ref.category === "asset" &&
          typeof ref.assetUrl === "string" &&
          ref.assetUrl.trim().length > 0 &&
          (ref.assetType === "image" || ref.assetType === "video" || ref.assetType === "audio"),
      ),
    [attachedRefs],
  )

  React.useEffect(() => {
    if (!activeRunInfo) return
    if (autoOpenedRunIdRef.current === activeRunInfo.runId) return
    autoOpenedRunIdRef.current = activeRunInfo.runId
    setActiveTab("preview")
  }, [activeRunInfo])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!cancelled) {
        setUserId(user?.id ?? null)
        setLoadingAuth(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadAutomations = React.useCallback(async (scopeOverride?: "mine" | "community") => {
    setLoadingList(true)
    try {
      const resolvedScope = scopeOverride ?? scope
      const q = resolvedScope === "community" ? "?scope=community" : "?scope=mine"
      const res = await fetch(`/api/automations${q}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(typeof j?.error === "string" ? j.error : "Failed to load")
      }
      const data = (await res.json()) as { automations: AutomationApi[] }
      setAutomations(data.automations)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load automations")
    } finally {
      setLoadingList(false)
    }
  }, [scope])

  // Load list when auth resolves (fetch-on-mount pattern).
  React.useEffect(() => {
    if (userId) {
      void loadAutomations()
    }
  }, [userId, loadAutomations])

  const goToCommunity = React.useCallback(() => {
    setSelectedId(null)
    setAutomationDetailsOpen(false)
    setRecentRunsOpen(false)
    setNewDialogOpen(false)
    lastHydratedId.current = null
    setScope("community")
  }, [])

  const goToMine = React.useCallback(() => {
    setSelectedId(null)
    setAutomationDetailsOpen(false)
    setRecentRunsOpen(false)
    lastHydratedId.current = null
    setScope("mine")
  }, [])

  const loadRuns = React.useCallback(async (automationId: string) => {
    setLoadingRuns(true)
    try {
      const res = await fetch(`/api/automations/${automationId}/runs`)
      if (!res.ok) {
        return
      }
      const data = (await res.json()) as { runs: AutomationRunApi[] }
      setRuns(data.runs)
    } finally {
      setLoadingRuns(false)
    }
  }, [])

  React.useEffect(() => {
    if (selectedId && !isCommunityScope) {
      void loadRuns(selectedId)
    } else {
      setRuns([])
    }
  }, [selectedId, loadRuns, isCommunityScope])

  const effectiveCron = React.useMemo(() => {
    if (presetTab === "custom") {
      return customCron.trim()
    }
    return buildCronFromPreset(presetKind, {
      dailyHour,
      dailyMinute,
      weeklyDow,
      weeklyHour,
      weeklyMinute,
      customCron,
    })
  }, [
    presetTab,
    presetKind,
    dailyHour,
    dailyMinute,
    weeklyDow,
    weeklyHour,
    weeklyMinute,
    customCron,
  ])

  React.useEffect(() => {
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        if (!effectiveCron || !userId) {
          setNextPreview(null)
          return
        }
        try {
          const res = await fetch("/api/automations/schedule-preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cronSchedule: effectiveCron, timezone }),
          })
          const j = await res.json().catch(() => ({}))
          if (!cancelled && res.ok && typeof j?.nextRunAt === "string") {
            setNextPreview(new Date(j.nextRunAt).toLocaleString())
          }
        } catch {
          if (!cancelled) setNextPreview(null)
        }
      })()
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [effectiveCron, timezone, userId])

  const resetFormForNew = React.useCallback(() => {
    lastHydratedId.current = null
    setSelectedId(null)
    setAutomationDetailsOpen(false)
    setRecentRunsOpen(false)
    setName("")
    setDescription("")
    setPrompt("")
    setAttachedRefs([])
    setSavedAttachments([])
    setUploadQueue([])
    setAutomationVariables([])
    setAssetPickerForVariable(null)
    setTimezone(getDefaultTimeZone())
    setModel(DEFAULT_CHAT_GATEWAY_MODEL)
    setPresetTab("presets")
    setPresetKind("daily")
    setDailyHour(9)
    setDailyMinute(0)
    setWeeklyDow(1)
    setWeeklyHour(9)
    setWeeklyMinute(0)
    setCustomCron(CRON_PRESET_HOURLY)
    setIsPublicAutomation(false)
    setVariablesDialogOpen(false)
    setNewDialogOpen(true)
  }, [])

  const openCreateAutomation = React.useCallback(() => {
    if (scope !== "mine") {
      setScope("mine")
    }
    resetFormForNew()
  }, [resetFormForNew, scope])

  const hydrateFromAutomation = React.useCallback((a: AutomationApi) => {
    setName(a.name)
    setDescription(typeof a.description === "string" ? a.description : "")
    const payload = a.prompt_payload
    if (payload && typeof payload.text === "string") {
      setPrompt(payload.text)
      setAttachedRefs(Array.isArray(payload.refs) ? (payload.refs as AttachedRef[]) : [])
      setSavedAttachments(Array.isArray(payload.attachments) ? payload.attachments : [])
      const norm = normalizeAutomationPromptPayload(a.prompt, a.prompt_payload)
      setAutomationVariables(norm.variables ?? [])
    } else {
      setPrompt(a.prompt)
      setAttachedRefs([])
      setSavedAttachments([])
      setAutomationVariables([])
    }
    setUploadQueue([])
    setTimezone(a.timezone || getDefaultTimeZone())
    setModel(normalizeChatGatewayModelSelection(a.model ?? DEFAULT_CHAT_GATEWAY_MODEL))
    setIsPublicAutomation(a.is_public === true)
    setVariablesDialogOpen(false)
    const inferred = inferPresetFromCron(a.cron_schedule)
    switch (inferred.kind) {
      case "hourly":
        setPresetKind("hourly")
        setPresetTab("presets")
        setCustomCron(a.cron_schedule)
        break
      case "daily":
        setPresetKind("daily")
        setPresetTab("presets")
        setDailyHour(inferred.hour)
        setDailyMinute(inferred.minute)
        setCustomCron(a.cron_schedule)
        break
      case "weekly":
        setPresetKind("weekly")
        setPresetTab("presets")
        setWeeklyDow(inferred.dayOfWeek)
        setWeeklyHour(inferred.hour)
        setWeeklyMinute(inferred.minute)
        setCustomCron(a.cron_schedule)
        break
      case "custom":
        setPresetTab("custom")
        setCustomCron(a.cron_schedule)
        break
      default: {
        const _e: never = inferred
        void _e
      }
    }
    needsEditBaselineCaptureRef.current = true
  }, [])

  const handleAttachFiles = React.useCallback(async (files: File[]) => {
    if (files.length === 0) return
    const next: AutomationPendingUpload[] = files.map((file) => ({
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      file,
      isUploading: true,
    }))
    setUploadQueue((prev) => [...prev, ...next])

    await Promise.all(
      next.map(async (item) => {
        const result = await uploadFileToSupabase(item.file, "chat-user-uploads")
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  isUploading: false,
                  uploadedUrl: result?.url,
                }
              : q,
          ),
        )
      }),
    )
  }, [])

  const handleAssetLibrarySelect = React.useCallback(
    (pick: AssetSelectionPick) => {
      if (assetPickerForVariable) {
        const base = attachedRefFromAssetPick(pick)
        const taken = new Set<string>()
        for (const r of attachedRefs) {
          if (r.mentionToken) taken.add(r.mentionToken)
        }
        for (const v of automationVariables) {
          for (const it of v.items) {
            if (it.kind === "ref" && it.ref.mentionToken) taken.add(it.ref.mentionToken)
          }
        }
        const mentionToken = makeMentionToken(base, taken)
        const ref: AttachedRef = { ...base, mentionToken }
        const target = assetPickerForVariable
        setAutomationVariables((prev) =>
          prev.map((v) => {
            if (v.id !== target.variableId) return v
            const items = v.items.map((it, i) => {
              if (i !== target.itemIndex || it.kind !== "ref") return it
              return { kind: "ref" as const, ref }
            })
            return { ...v, items }
          }),
        )
        setAssetPickerForVariable(null)
        setAssetModalOpen(false)
        return
      }
      setAttachedRefs((prev) => [...prev, attachedRefFromAssetPick(pick)])
      setAssetModalOpen(false)
    },
    [assetPickerForVariable, attachedRefs, automationVariables],
  )

  const insertVariableToken = React.useCallback((token: string) => {
    setPrompt((prev) => {
      if (!prev) return token
      return prev.endsWith(" ") || prev.endsWith("\n") ? `${prev}${token}` : `${prev} ${token}`
    })
  }, [])

  const generateAutomationDescription = React.useCallback(
    async (input: { name: string; prompt: string; scheduleSummary: string }) => {
      const res = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildAutomationDescriptionPrompt(input),
        }),
      })

      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to generate description")
      }

      const descriptionText =
        typeof data.text === "string" ? normalizeAutomationDescription(data.text) : ""
      if (!descriptionText) {
        throw new Error("Failed to generate description")
      }

      return descriptionText
    },
    [],
  )

  const sanitizedVariables = React.useMemo(() => sanitizeAutomationVariables(automationVariables), [automationVariables])

  const currentPromptPayload = React.useMemo((): AutomationPromptPayload => {
    const attachments: AutomationPromptAttachment[] = [
      ...savedAttachments,
      ...uploadQueue
        .filter((u) => u.uploadedUrl)
        .map((u) => ({
          url: u.uploadedUrl!,
          mediaType: u.file.type || "application/octet-stream",
          filename: u.file.name,
        })),
    ]
    return {
      text: prompt.trim(),
      refs: attachedRefs,
      attachments,
      ...(sanitizedVariables.length > 0 ? { variables: sanitizedVariables } : {}),
    }
  }, [prompt, attachedRefs, savedAttachments, uploadQueue, sanitizedVariables])

  const persistSnapshot = React.useMemo(() => {
    if (!selected || newDialogOpen || isCommunityScope) return ""
    const cron = presetTab === "custom" ? customCron.trim() : effectiveCron
    const snapshot = buildPersistSnapshot({
      name,
      description,
      promptPayload: currentPromptPayload,
      cronSchedule: cron,
      timezone,
      model,
      isPublic: isPublicAutomation,
    })
    return snapshot
  }, [
    selected,
    newDialogOpen,
    isCommunityScope,
    name,
    description,
    currentPromptPayload,
    presetTab,
    customCron,
    effectiveCron,
    timezone,
    model,
    isPublicAutomation,
  ])

  React.useLayoutEffect(() => {
    if (!needsEditBaselineCaptureRef.current || !selectedId) return
    setEditBaselineSnapshot(persistSnapshot)
    needsEditBaselineCaptureRef.current = false
  }, [persistSnapshot, selectedId])

  React.useEffect(() => {
    setEditBaselineSnapshot("")
  }, [selectedId])

  const hasUnsavedEdits =
    !isCommunityScope &&
    !newDialogOpen &&
    Boolean(selected) &&
    editBaselineSnapshot !== "" &&
    persistSnapshot !== editBaselineSnapshot

  const revertEditsToSaved = React.useCallback(() => {
    if (!selected || isCommunityScope || newDialogOpen) return
    hydrateFromAutomation(selected)
    needsEditBaselineCaptureRef.current = true
  }, [selected, isCommunityScope, newDialogOpen, hydrateFromAutomation])

  const forceCloseEditDialog = React.useCallback(() => {
    setUnsavedCloseConfirmOpen(false)
    setEditDetailsOpen(false)
  }, [])

  const requestCloseEditDialog = React.useCallback(() => {
    if (isCommunityScope || !hasUnsavedEdits) {
      forceCloseEditDialog()
      return
    }
    setUnsavedCloseConfirmOpen(true)
  }, [isCommunityScope, hasUnsavedEdits, forceCloseEditDialog])

  const handleEditDialogOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) {
        setEditDetailsOpen(true)
        return
      }
      requestCloseEditDialog()
    },
    [requestCloseEditDialog],
  )

  const discardEditAndClose = React.useCallback(() => {
    revertEditsToSaved()
    forceCloseEditDialog()
  }, [revertEditsToSaved, forceCloseEditDialog])

  const previewTemplatePayload = React.useMemo((): AutomationPromptPayload | null => {
    if (!selected) return null
    if (scope === "community") {
      return normalizeAutomationPromptPayload(selected.prompt, selected.prompt_payload)
    }
    return currentPromptPayload
  }, [selected, scope, currentPromptPayload])

  React.useEffect(() => {
    if (!selectedId || !selected) {
      return
    }
    if (lastHydratedId.current === selectedId) {
      return
    }
    hydrateFromAutomation(selected)
    lastHydratedId.current = selectedId
  }, [selectedId, selected, hydrateFromAutomation])

  const save = async (options?: { closeAfter?: boolean }): Promise<boolean> => {
    if (isCommunityScope) return false
    if (!name.trim() || !prompt.trim()) {
      toast.error("Title and prompt are required")
      return false
    }
    if (uploadQueue.some((u) => u.isUploading)) {
      toast.error("Wait for uploads to finish")
      return false
    }
    const cron = presetTab === "custom" ? customCron.trim() : effectiveCron
    if (!cron) {
      toast.error("Schedule is required")
      return false
    }
    const vars = sanitizeAutomationVariables(automationVariables)
    const promptPayload: AutomationPromptPayload = {
      text: prompt.trim(),
      refs: attachedRefs,
      attachments: [
        ...savedAttachments,
        ...uploadQueue
          .filter((u) => u.uploadedUrl)
          .map((u) => ({
            url: u.uploadedUrl!,
            mediaType: u.file.type || "application/octet-stream",
            filename: u.file.name,
          })),
      ],
      ...(vars.length > 0 ? { variables: vars } : {}),
    }
    const scheduleSummary = describeCronHumanSummary(cron)
    setIsSaving(true)
    try {
      const generatedDescription = await generateAutomationDescription({
        name: name.trim(),
        prompt: promptPayload.text,
        scheduleSummary,
      })
      setDescription(generatedDescription)

      if (newDialogOpen) {
        const res = await fetch("/api/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: generatedDescription,
            promptPayload,
            cronSchedule: cron,
            timezone,
            model: model || null,
            isActive: true,
            isPublic: isPublicAutomation,
          }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(typeof j?.error === "string" ? j.error : "Save failed")
        }
        toast.success("Automation created")
        setNewDialogOpen(false)
        await loadAutomations()
        const created = j.automation as AutomationApi | undefined
        if (created?.id) {
          lastHydratedId.current = null
          setSelectedId(created.id)
        }
        return true
      } else if (selected) {
        const res = await fetch(`/api/automations/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: generatedDescription,
            promptPayload,
            cronSchedule: cron,
            timezone,
            model: model || null,
            isPublic: isPublicAutomation,
          }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(typeof j?.error === "string" ? j.error : "Save failed")
        }
        toast.success("Saved")
        setEditBaselineSnapshot(persistSnapshot)
        lastHydratedId.current = null
        await loadAutomations()
        if (options?.closeAfter) {
          forceCloseEditDialog()
        }
        return true
      }
      return false
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const saveAndCloseEdit = async () => {
    const ok = await save({ closeAfter: true })
    if (ok) {
      setUnsavedCloseConfirmOpen(false)
    }
  }

  const toggleActive = async (a: AutomationApi, next: boolean) => {
    try {
      const res = await fetch(`/api/automations/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(typeof j?.error === "string" ? j.error : "Update failed")
      }
      await loadAutomations()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed")
    }
  }

  const runNow = async (a: AutomationApi) => {
    setRunningId(a.id)
    setActiveRunInfo(null)
    setPendingManualRunPreview((prev) => (prev?.automationId === a.id ? null : prev))

    const pollState = { cancelled: false }
    void (async () => {
      const deadline = Date.now() + 60_000
      while (!pollState.cancelled && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 800))
        if (pollState.cancelled) return
        try {
          const res = await fetch(`/api/automations/${a.id}/runs`)
          if (!res.ok) continue
          const data = (await res.json()) as { runs: AutomationRunApi[] }
          const active = data.runs.find(
            (run) => run.status === "running" && (run.run_trigger ?? "scheduled") === "manual",
          )
          if (active && !pollState.cancelled) {
            setActiveRunInfo({
              automationId: a.id,
              runId: active.id,
              threadId: active.thread_id,
            })
            return
          }
        } catch {
          // keep polling
        }
      }
    })()

    try {
      const res = await fetch(`/api/automations/${a.id}/run`, { method: "POST" })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof j?.error === "string" ? j.error : "Run failed")
      }
      toast.success("Automation run finished")
      if (typeof j?.runId === "string") {
        setPendingManualRunPreview({
          automationId: a.id,
          runId: j.runId,
          threadId: typeof j.threadId === "string" ? j.threadId : null,
          status: "completed",
          error: null,
        })
      }
      await loadAutomations()
      await loadRuns(a.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed")
    } finally {
      pollState.cancelled = true
      setRunningId(null)
      setActiveRunInfo(null)
    }
  }

  const cloneFromCommunity = async (a: AutomationApi) => {
    setCloningId(a.id)
    try {
      const res = await fetch(`/api/automations/${a.id}/clone`, { method: "POST" })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof j?.error === "string" ? j.error : "Clone failed")
      }
      toast.success("Saved. Edit and run from Mine")
      setScope("mine")
      const created = j.automation as AutomationApi | undefined
      await loadAutomations("mine")
      if (created?.id) {
        lastHydratedId.current = null
        setSelectedId(created.id)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clone failed")
    } finally {
      setCloningId(null)
    }
  }

  const openCommunityPreview = (a: AutomationApi) => {
    if (!a.hasPreview) {
      toast.error("No preview available yet")
      return
    }
    setCommunityPreviewOpen(true)
  }

  const setCommunityPreviewRun = async (automationId: string, runId: string) => {
    setSettingPreviewRunId(runId)
    try {
      const res = await fetch(`/api/automations/${automationId}/preview/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof j?.error === "string" ? j.error : "Failed to set preview")
      }
      toast.success("Preview updated")
      lastHydratedId.current = null
      await loadAutomations()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set preview")
    } finally {
      setSettingPreviewRunId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/automations/${deleteId}`, { method: "DELETE" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(typeof j?.error === "string" ? j.error : "Delete failed")
      }
      toast.success("Automation deleted")
      if (selectedId === deleteId) {
        setSelectedId(null)
        lastHydratedId.current = null
      }
      setDeleteId(null)
      await loadAutomations()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed")
    }
  }

  function renderAutomationFormFields(
    idPrefix: string,
    opts: {
      readOnly?: boolean
      showVisibility?: boolean
      showInlineActions?: boolean
      showManualSaveActions?: boolean
    } = {},
  ) {
    const readOnly = opts.readOnly ?? false
    const showVisibility = opts.showVisibility ?? false
    const showInlineActions = opts.showInlineActions ?? false
    const showManualSaveActions = opts.showManualSaveActions ?? false
    const scheduleModeValue = presetTab === "custom" ? "custom" : presetKind
    const scheduleControlLabel = describeScheduleControlLabel({
      presetTab,
      presetKind,
      dailyHour,
      dailyMinute,
      weeklyDow,
      weeklyHour,
      weeklyMinute,
    })
    const showVariableControls = !readOnly || automationVariables.length > 0
    return (
      <>
      <fieldset
        disabled={readOnly}
        className="min-w-0 rounded-[30px] border-0 p-0 -outline-offset-1 outline-1 outline-foreground/15 disabled:opacity-[0.92]"
      >
      <div className="min-w-0 overflow-hidden rounded-[30px] border border-border/60 bg-background/95 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.7)]">
      <div className="space-y-4 px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`} className="sr-only">
            Automation title
          </Label>
          <Input
            id={`${idPrefix}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Automation title"
            disabled={readOnly}
            className="mr-2 h-auto border-0 bg-transparent px-2 text-lg font-semibold shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-0 md:text-xl"
          />
          <p className="text-xs text-muted-foreground">
            Keep the title short. The prompt does the heavy lifting.
          </p>
        </div>
        {(savedAttachments.length > 0 || selectedAssetRefs.length > 0 || uploadQueue.length > 0) && (
          <div className="flex flex-row flex-wrap gap-2">
            {savedAttachments.map((att) => {
              const kind = mediaKindFromMime(att.mediaType)
              return (
                <div key={att.url} className="relative">
                  {kind === "image" ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-border bg-muted/40">
                      <img src={att.url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : kind === "video" ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-border bg-muted/40">
                      <video src={att.url} muted playsInline className="h-full w-full object-cover" />
                    </div>
                  ) : kind === "audio" ? (
                    <div className="flex h-16 min-w-[180px] max-w-[220px] items-center rounded-2xl border border-border bg-muted/40 px-2">
                      <audio src={att.url} controls className="h-8 w-full" />
                    </div>
                  ) : (
                    <Badge variant="outline" className="max-w-[220px] rounded-full px-3 py-1.5">
                      {att.filename ?? "File"}
                    </Badge>
                  )}
                  <button
                    type="button"
                    disabled={readOnly}
                    className="absolute -top-1.5 -right-1.5 z-10 rounded-full border border-border bg-background p-1 shadow-sm hover:bg-destructive hover:text-destructive-foreground disabled:pointer-events-none disabled:opacity-50"
                    aria-label="Remove attachment"
                    onClick={() => setSavedAttachments((prev) => prev.filter((x) => x.url !== att.url))}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              )
            })}
            {selectedAssetRefs.map((ref) => {
              const kind = ref.assetType
              return (
                <div key={ref.chipId} className="relative">
                  {kind === "image" ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-border bg-muted/40">
                      <img src={ref.previewUrl ?? ref.assetUrl ?? ""} alt={ref.label} className="h-full w-full object-cover" />
                    </div>
                  ) : kind === "video" ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-border bg-muted/40">
                      <video
                        src={ref.assetUrl ?? ""}
                        poster={ref.previewUrl ?? undefined}
                        muted
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : kind === "audio" ? (
                    <div className="flex h-16 min-w-[180px] max-w-[220px] items-center rounded-2xl border border-border bg-muted/40 px-2">
                      <audio src={ref.assetUrl ?? ""} controls className="h-8 w-full" />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={readOnly}
                    className="absolute -top-1.5 -right-1.5 z-10 rounded-full border border-border bg-background p-1 shadow-sm hover:bg-destructive hover:text-destructive-foreground disabled:pointer-events-none disabled:opacity-50"
                    aria-label="Remove asset"
                    onClick={() => setAttachedRefs((prev) => prev.filter((x) => x.chipId !== ref.chipId))}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              )
            })}
            {uploadQueue.map((u) => (
              <div
                key={u.id}
                className="relative inline-flex max-w-[240px] items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1.5 pr-8 text-xs"
              >
                <span className="truncate" title={u.file.name}>
                  {u.file.name}
                </span>
                {u.isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : null}
                <button
                  type="button"
                  disabled={readOnly}
                  className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full p-1 hover:bg-destructive hover:text-destructive-foreground disabled:pointer-events-none disabled:opacity-50"
                  aria-label="Remove upload"
                  onClick={() => {
                    setUploadQueue((prev) => prev.filter((x) => x.id !== u.id))
                  }}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-prompt`} className="sr-only">
            Prompt
          </Label>
          <div className="relative">
            <CommandTextarea
              value={prompt}
              onChange={setPrompt}
              refs={attachedRefs}
              onRefsChange={setAttachedRefs}
              rows={10}
              className="min-h-[240px] max-h-[420px] rounded-none border-0 bg-transparent px-0 py-0 pr-3 font-mono text-sm leading-6 shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-0"
              placeholder="Add prompt e.g. create tomorrow's post ideas, captions, and image directions. Type / for templates, @ for brands and assets."
              slashCommands={AUTOMATION_SLASH_COMMANDS}
              slashCommandsContext="Automation"
              onPasteImage={(file) => void handleAttachFiles([file])}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border/50 px-5 py-3 sm:px-6">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            void handleAttachFiles(files)
            if (fileInputRef.current) {
              fileInputRef.current.value = ""
            }
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" aria-label="Attach files or assets">
                <PlusPhosphor className="h-4 w-4" />
                Attach
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={6}>
              <DropdownMenuItem
                onClick={() => {
                  setAssetPickerForVariable(null)
                  fileInputRef.current?.click()
                }}
              >
                <FilePlus className="mr-2 size-4" />
                Upload files
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setAssetPickerForVariable(null)
                  setAssetModalOpen(true)
                }}
              >
                <FolderOpen className="mr-2 size-4" />
                Select asset
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {showVariableControls ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                  {readOnly ? "Variables" : "Add variable"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" sideOffset={6}>
                {!readOnly ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setAutomationVariables((prev) => [...prev, makeNewAutomationVariable(prev)])
                      setVariablesDialogOpen(true)
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    New variable
                  </DropdownMenuItem>
                ) : null}
                {automationVariables.length > 0 ? (
                  <>
                    <DropdownMenuLabel>{readOnly ? "Saved variables" : "Insert token"}</DropdownMenuLabel>
                    {automationVariables.map((variable) => (
                      <DropdownMenuItem
                        key={variable.id}
                        onClick={() => {
                          if (readOnly) {
                            setVariablesDialogOpen(true)
                            return
                          }
                          insertVariableToken(`{{${variable.id}}}`)
                        }}
                      >
                        <span className="truncate">{variable.name}</span>
                        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                          {`{{${variable.id}}}`}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setVariablesDialogOpen(true)}>
                  {readOnly ? "View variables" : "Manage variables"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <Select value={model} onValueChange={setModel} disabled={readOnly}>
            <SelectTrigger id={`${idPrefix}-model`} className="min-w-[190px] bg-background/80">
              <SelectValue placeholder="Select model">
                {(() => {
                  const opt = getChatGatewayModelOption(model)
                  return (
                    <div className="flex items-center gap-2">
                      <ModelIcon identifier={opt.id} size={14} srcOverride={opt.iconPath} />
                      <span>{opt.label}</span>
                    </div>
                  )
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" side="top" sideOffset={6}>
              {CHAT_GATEWAY_MODEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
                      <ModelIcon identifier={opt.id} size={18} srcOverride={opt.iconPath} />
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="min-w-[190px] justify-start">
                <CalendarClock className="h-4 w-4" />
                <span className="truncate">{scheduleControlLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(92vw,360px)] space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-schedule-mode`} className="text-xs">
                  Repeat
                </Label>
                <Select
                  value={scheduleModeValue}
                  onValueChange={(value) => {
                    if (value === "custom") {
                      setPresetTab("custom")
                      return
                    }
                    setPresetTab("presets")
                    setPresetKind(value as InferredPreset["kind"])
                  }}
                  disabled={readOnly}
                >
                  <SelectTrigger id={`${idPrefix}-schedule-mode`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    {presetTab === "custom" ? <SelectItem value="custom">Custom cron</SelectItem> : null}
                  </SelectContent>
                </Select>
              </div>

              {presetTab === "custom" ? (
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}-custom-cron`} className="text-xs">
                    Custom cron
                  </Label>
                  <Textarea
                    id={`${idPrefix}-custom-cron`}
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    rows={3}
                    className="font-mono text-xs"
                    placeholder="0 0 * * * *"
                    disabled={readOnly}
                  />
                  <p className="text-xs text-muted-foreground">
                    Power-user mode. Choose a preset above anytime to simplify this automation again.
                  </p>
                </div>
              ) : null}

              {presetTab !== "custom" && presetKind === "hourly" ? (
                <p className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Runs every hour on the hour.
                </p>
              ) : null}

              {presetTab !== "custom" && presetKind === "daily" ? (
                <div className="space-y-2">
                  <Label className="text-xs">Time</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(dailyHour)}
                      onValueChange={(value) => setDailyHour(Number(value))}
                      disabled={readOnly}
                    >
                      <SelectTrigger size="sm" className="w-[92px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" className="max-h-48">
                        {SCHEDULE_HOURS.map((hour) => (
                          <SelectItem key={hour} value={String(hour)}>
                            {pad2(hour)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">:</span>
                    <Select
                      value={String(dailyMinute)}
                      onValueChange={(value) => setDailyMinute(Number(value))}
                      disabled={readOnly}
                    >
                      <SelectTrigger size="sm" className="w-[92px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" className="max-h-48">
                        {SCHEDULE_MINUTES.map((minute) => (
                          <SelectItem key={minute} value={String(minute)}>
                            {pad2(minute)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              {presetTab !== "custom" && presetKind === "weekly" ? (
                <div className="space-y-2">
                  <Label className="text-xs">Weekly schedule</Label>
                  <div className="grid gap-2 sm:grid-cols-[1.3fr_1fr_1fr]">
                    <Select
                      value={String(weeklyDow)}
                      onValueChange={(value) => setWeeklyDow(Number(value))}
                      disabled={readOnly}
                    >
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((day) => (
                          <SelectItem key={day.value} value={day.value}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={String(weeklyHour)}
                      onValueChange={(value) => setWeeklyHour(Number(value))}
                      disabled={readOnly}
                    >
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" className="max-h-48">
                        {SCHEDULE_HOURS.map((hour) => (
                          <SelectItem key={hour} value={String(hour)}>
                            {pad2(hour)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={String(weeklyMinute)}
                      onValueChange={(value) => setWeeklyMinute(Number(value))}
                      disabled={readOnly}
                    >
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" className="max-h-48">
                        {SCHEDULE_MINUTES.map((minute) => (
                          <SelectItem key={minute} value={String(minute)}>
                            {pad2(minute)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-tz-popover`} className="text-xs">
                  Timezone
                </Label>
                <Select value={timezone} onValueChange={setTimezone} disabled={readOnly}>
                  <SelectTrigger id={`${idPrefix}-tz-popover`} className="w-full font-mono text-xs">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[min(60dvh,320px)]">
                    {ianaZones.map((tz) => (
                      <SelectItem key={tz} value={tz} className="font-mono text-xs">
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>

          {showVisibility || showInlineActions || showManualSaveActions ? (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {showVisibility ? (
                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor={`${idPrefix}-is-public`} className="cursor-pointer text-sm">
                    Public
                  </Label>
                  <Switch
                    id={`${idPrefix}-is-public`}
                    checked={isPublicAutomation}
                    onCheckedChange={setIsPublicAutomation}
                    disabled={readOnly}
                  />
                </div>
              ) : null}
              {showInlineActions ? (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => setNewDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={() => void save()} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      "Create"
                    )}
                  </Button>
                </>
              ) : null}
              {showManualSaveActions ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={requestCloseEditDialog}
                    disabled={isSaving}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void save()}
                    disabled={!hasUnsavedEdits || isSaving || uploadQueue.some((u) => u.isUploading)}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            {nextPreview ? (
              <span>
                Next run: <strong className="text-foreground">{nextPreview}</strong>
              </span>
            ) : (
              <span>Pick a schedule to see when it will run next.</span>
            )}
          </div>
          <span className="font-mono">{timezone}</span>
          {automationVariables.length > 0 ? (
            <span>
              {automationVariables.length} variable{automationVariables.length === 1 ? "" : "s"} ready
            </span>
          ) : null}
          {showVisibility && isPublicAutomation ? <span>Visible in Community</span> : null}
        </div>
      </div>
      </div>
      </fieldset>

      {showVariableControls ? (
        <Dialog open={variablesDialogOpen} onOpenChange={setVariablesDialogOpen}>
          <DialogContent className="max-h-[min(88dvh,900px)] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{readOnly ? "Variables" : "Manage variables"}</DialogTitle>
              <DialogDescription>
                Keep the main automation UI focused on the prompt. Use this panel when you want to add,
                rotate, or inspect variable values.
              </DialogDescription>
            </DialogHeader>
            <VariablesEditor
              variables={automationVariables}
              onChange={readOnly ? () => {} : setAutomationVariables}
              onInsertToken={insertVariableToken}
              onRequestPickRef={(variableId, itemIndex) => {
                if (readOnly) return
                setAssetPickerForVariable({ variableId, itemIndex })
                setAssetModalOpen(true)
              }}
              extraRefs={attachedRefs}
              promptContext={prompt}
              disabled={readOnly}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVariablesDialogOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {false ? (
        <>
          <fieldset disabled={readOnly} className="min-w-0 space-y-6 border-0 p-0 disabled:opacity-[0.92]">
      {showVisibility ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
            <div className="space-y-0.5">
              <Label htmlFor={`${idPrefix}-is-public`} className="text-sm">
                Share with the community
              </Label>
              <p className="text-xs text-muted-foreground">
                Let other creators find this and save a copy to their own account. Your chats stay private.
              </p>
            </div>
            <Switch
              id={`${idPrefix}-is-public`}
              checked={isPublicAutomation}
              onCheckedChange={setIsPublicAutomation}
              disabled={readOnly}
            />
          </div>
          {isPublicAutomation ? (
            <p className="text-xs text-muted-foreground">
              Once you run it successfully, you can pick which run shows up as the preview.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <Label>When should it run?</Label>
        <Tabs value={presetTab} onValueChange={(v) => setPresetTab(v as "presets" | "custom")}>
          <TabsList>
            <TabsTrigger value="presets">Common times</TabsTrigger>
            <TabsTrigger value="custom">Custom timing</TabsTrigger>
          </TabsList>
          <TabsContent value="presets" className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["hourly", "Hourly"],
                  ["daily", "Daily"],
                  ["weekly", "Weekly"],
                ] as const
              ).map(([k, label]) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={presetKind === k ? "default" : "outline"}
                  onClick={() => setPresetKind(k)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {presetKind === "daily" ? (
              <div className="flex flex-wrap gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Hour (0–23)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={dailyHour}
                    onChange={(e) => setDailyHour(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Minute (0–59)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={dailyMinute}
                    onChange={(e) => setDailyMinute(Number(e.target.value))}
                  />
                </div>
              </div>
            ) : null}
            {presetKind === "weekly" ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                <div className="space-y-1">
                  <Label className="text-xs">Day</Label>
                  <Select value={String(weeklyDow)} onValueChange={(v) => setWeeklyDow(Number(v))}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hour</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={weeklyHour}
                    onChange={(e) => setWeeklyHour(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Minute</Label>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={weeklyMinute}
                    onChange={(e) => setWeeklyMinute(Number(e.target.value))}
                  />
                </div>
              </div>
            ) : null}
          </TabsContent>
          <TabsContent value="custom" className="pt-4">
            <Textarea
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              rows={2}
              className="font-mono text-sm"
              placeholder="0 0 * * * *"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              For power users: cron format with 6 fields (second, minute, hour, day, month, weekday).
              E.g. <code>0 0 * * * *</code> runs every hour on the hour.
            </p>
          </TabsContent>
        </Tabs>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            {nextPreview ? (
              <span>
                Next run: <strong className="text-foreground">{nextPreview}</strong>
              </span>
            ) : (
              <span>Pick a schedule to see when it will run next.</span>
            )}
          </div>
          <span className="inline-flex items-center gap-1">
            <span>Timezone:</span>
            <span className="font-mono text-foreground/80">{timezone}</span>
            {!readOnly ? (
              <>
                <span aria-hidden="true">·</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      Change
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[280px] p-3">
                    <div className="space-y-2">
                      <Label htmlFor={`${idPrefix}-tz-popover`} className="text-xs">
                        Timezone
                      </Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger
                          id={`${idPrefix}-tz-popover`}
                          className="w-full font-mono text-xs"
                        >
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[min(60dvh,320px)]">
                          {ianaZones.map((tz) => (
                            <SelectItem
                              key={tz}
                              value={tz}
                              className="font-mono text-xs"
                            >
                              {tz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            ) : null}
          </span>
        </div>
      </div>
      </fieldset>
        </>
      ) : null}
      </>
    )
  }

  if (loadingAuth) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center pt-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-24 text-center">
        <h1 className="text-2xl font-semibold">Automations</h1>
        <p className="mt-2 text-muted-foreground">Your session expired. Sign in to manage automations.</p>
        <Button asChild className="mt-6">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    )
  }

  const canShowViewSetPreview =
    !isCommunityScope &&
    Boolean(selected?.is_public) &&
    Boolean(selected?.hasPreview) &&
    typeof selected?.preview_run_id === "string"

  const pendingManualForSelected =
    !isCommunityScope && pendingManualRunPreview?.automationId === selected?.id
      ? pendingManualRunPreview
      : null

  const showViewLastManualBtn =
    pendingManualForSelected != null &&
    (!canShowViewSetPreview ||
      !selected ||
      pendingManualForSelected.runId !== selected.preview_run_id)

  const pageTitle = isCommunityScope ? "Community Automations" : "Automations"
  const pageDescription = isCommunityScope
    ? "Browse shared workflows from other creators, preview the useful ones, and save a copy when one fits."
    : "Automate recurring creative work with scheduled chats that keep your content moving."

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1180px] px-4 pb-12 pt-20">
      <div className="flex flex-col gap-5 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{pageDescription}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isCommunityScope ? (
            <Button variant="outline" size="sm" onClick={goToMine}>
              <ArrowLeft className="h-4 w-4" />
              View Mine
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={goToCommunity}>
              <Globe className="h-4 w-4" />
              View Community
            </Button>
          )}
          <Button size="sm" onClick={openCreateAutomation}>
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </div>
      </div>

      <main className="pt-8">
        {loadingList ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : automations.length === 0 ? (
          <div className="flex min-h-[360px] w-full items-center justify-center">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarClock />
                </EmptyMedia>
                <EmptyTitle>
                  {isCommunityScope ? "No community automations yet" : "No automations yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {isCommunityScope
                    ? "Shared workflows will appear here once creators publish reusable automations."
                    : "Create your first scheduled workflow, or browse community automations for a useful starting point."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {isCommunityScope ? (
                    <Button variant="outline" size="sm" onClick={goToMine}>
                      <ArrowLeft className="h-4 w-4" />
                      View Mine
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={goToCommunity}>
                      <Globe className="h-4 w-4" />
                      View Community
                    </Button>
                  )}
                  <Button size="sm" onClick={openCreateAutomation}>
                    <Plus className="h-4 w-4" />
                    Create
                  </Button>
                </div>
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {automations.map((a) => {
              const latestRunThreadId = a.latestRun?.thread_id ?? null
              return (
                <li key={a.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setNewDialogOpen(false)
                      setSelectedId(a.id)
                      setEditDetailsOpen(false)
                      setActiveTab("preview")
                      skipResetEditOnDetailsCloseRef.current = false
                      setAutomationDetailsOpen(true)
                      setRecentRunsOpen(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setNewDialogOpen(false)
                        setSelectedId(a.id)
                        setEditDetailsOpen(false)
                        setActiveTab("preview")
                        skipResetEditOnDetailsCloseRef.current = false
                        setAutomationDetailsOpen(true)
                        setRecentRunsOpen(false)
                      }
                    }}
                    className={cn(
                      "group relative flex aspect-square h-auto w-full flex-col justify-end overflow-hidden rounded-2xl border text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      selectedId === a.id && automationDetailsOpen
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border/50 bg-card/45 hover:border-border hover:shadow-lg",
                    )}
                  >
                    {/* Media Preview Background */}
                    <div className="absolute inset-0 -z-10 w-full h-full overflow-hidden transition-transform duration-500 group-hover:scale-105">
                      <AutomationCardMedia
                        threadId={latestRunThreadId as string | null}
                        automationId={a.id}
                        isCommunity={isCommunityScope}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
                    </div>

                    {/* Hover Quick Actions */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      {isCommunityScope ? (
                        <>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="size-8 rounded-full shadow-md bg-background/90 backdrop-blur hover:bg-background"
                            disabled={cloningId === a.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              void cloneFromCommunity(a)
                            }}
                          >
                            {cloningId === a.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="size-8 rounded-full shadow-md bg-background/90 backdrop-blur hover:bg-background text-foreground"
                            disabled={!a.hasPreview}
                            onClick={(e) => {
                              e.stopPropagation()
                              setNewDialogOpen(false)
                              setSelectedId(a.id)
                              setEditDetailsOpen(false)
                              setActiveTab("preview")
                              skipResetEditOnDetailsCloseRef.current = false
                              setAutomationDetailsOpen(true)
                              setRecentRunsOpen(false)
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="size-8 rounded-full shadow-md bg-background/90 backdrop-blur hover:bg-background text-foreground"
                            disabled={runningId === a.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              void runNow(a)
                            }}
                          >
                            {runningId === a.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5 fill-current" />
                            )}
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="size-8 rounded-full shadow-md bg-background/90 backdrop-blur hover:bg-background text-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              setNewDialogOpen(false)
                              setSelectedId(a.id)
                              setEditDetailsOpen(false)
                              setActiveTab("edit")
                              skipResetEditOnDetailsCloseRef.current = false
                              setAutomationDetailsOpen(true)
                              setRecentRunsOpen(false)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Title & Info overlay */}
                    <div className="w-full p-4 flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="line-clamp-2 text-sm font-semibold leading-5 text-white drop-shadow">
                          {a.name}
                        </span>
                        <div className="flex shrink-0 gap-1.5">
                          {isCommunityScope ? (
                            <>
                              {a.user_id === userId ? (
                                <Badge variant="default" className="h-4 rounded-full px-1.5 text-[9px] bg-primary text-primary-foreground border-0">
                                  Yours
                                </Badge>
                              ) : null}
                              {a.hasPreview ? (
                                <Badge variant="outline" className="h-4 rounded-full px-1.5 text-[9px] border-white/30 text-white bg-black/30 backdrop-blur-sm">
                                  Preview
                                </Badge>
                              ) : null}
                            </>
                          ) : (
                            <>
                              {a.is_public === true ? (
                                <Badge variant="outline" className="h-4 rounded-full px-1.5 text-[9px] border-white/30 text-white bg-black/30 backdrop-blur-sm">
                                  Public
                                </Badge>
                              ) : null}
                              <Badge variant={a.is_active ? "default" : "secondary"} className="h-4 rounded-full px-1.5 text-[9px] border-0">
                                {a.is_active ? "On" : "Off"}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <p className="line-clamp-2 text-xs leading-normal text-zinc-300 drop-shadow">
                        {a.description?.trim() || describeCronHumanSummary(a.cron_schedule)}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2.5 text-[10px] text-zinc-400">
                        <span className="line-clamp-1">{describeCronHumanSummary(a.cron_schedule)}</span>
                        {!isCommunityScope && a.last_error ? (
                          <span className="truncate text-red-400 font-medium">Error occurred</span>
                        ) : (
                          <Eye className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <Dialog
        open={Boolean(selected && automationDetailsOpen)}
        onOpenChange={(open) => {
          if (!open && hasUnsavedEdits) {
            setUnsavedCloseConfirmOpen(true)
            return
          }
          setAutomationDetailsOpen(open)
          if (!open) {
            setRecentRunsOpen(false)
            setVariablesDialogOpen(false)
            if (!skipResetEditOnDetailsCloseRef.current) {
              setEditDetailsOpen(false)
            }
            skipResetEditOnDetailsCloseRef.current = false
          }
        }}
      >
        {selected ? (
          <DialogContent
            className={cn(
              "flex! h-[min(640px,90dvh)] max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-[min(880px,calc(100vw-1.5rem))]! flex-col gap-0 overflow-hidden rounded-2xl border-border/60 bg-background p-0",
              "sm:w-[calc(100%-2rem)] sm:max-w-[min(880px,calc(100vw-2rem))]!"
            )}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>{selected.name}</DialogTitle>
              <DialogDescription>
                Review, edit, run, or inspect this automation.
              </DialogDescription>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              <aside className="hidden w-[148px] shrink-0 flex-col border-r border-border/60 bg-muted/20 px-2 py-2.5 lg:flex">
                <DialogPrimitive.Close asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mb-4 size-9 shrink-0 rounded-lg"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogPrimitive.Close>
                <AutomationTabNav
                  activeTab={activeTab}
                  onSelect={setActiveTab}
                  variant="sidebar"
                  isCommunity={isCommunityScope}
                />
              </aside>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {/* Desktop header: Title + actions */}
                <div className="hidden shrink-0 items-center justify-between border-b border-border/60 px-5 py-3 lg:flex">
                  <span className="text-base font-semibold text-foreground truncate max-w-[240px]">
                    {selected.name}
                  </span>
                  
                  {/* Actions Row */}
                  <div className="flex items-center gap-3">
                    {!isCommunityScope ? (
                      <>
                        <div className="flex items-center gap-2 pr-3 border-r border-border/50 h-6">
                          <Switch
                            checked={selected.is_active}
                            onCheckedChange={(v) => void toggleActive(selected, v)}
                            id="active-switch-modal"
                          />
                          <Label htmlFor="active-switch-modal" className="text-xs font-medium cursor-pointer">
                            Active
                          </Label>
                        </div>
                        {runningId === selected.id ? (
                          <Button variant="secondary" size="sm" disabled className="h-8">
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Running…
                          </Button>
                        ) : (
                          <Button variant="secondary" size="sm" onClick={() => void runNow(selected)} className="h-8">
                            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                            Run now
                          </Button>
                        )}
                        <Button variant="outline" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(selected.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {selected.user_id === userId ? (
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => {
                              const id = selected.id
                              setScope("mine")
                              lastHydratedId.current = null
                              setSelectedId(id)
                              setCommunityPreviewOpen(false)
                            }}
                          >
                            Edit in Mine
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-8"
                            disabled={cloningId === selected.id}
                            onClick={() => void cloneFromCommunity(selected)}
                          >
                            {cloningId === selected.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Save to mine
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Mobile header (includes scroll nav and actions) */}
                <div className="shrink-0 border-b border-border/60 lg:hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <DialogPrimitive.Close asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0 rounded-lg"
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </DialogPrimitive.Close>
                    <span className="text-base font-semibold text-foreground truncate max-w-[160px]">
                      {selected.name}
                    </span>
                    
                    {/* Mobile quick actions (Run now or Clone/Edit in Mine) */}
                    <div className="flex items-center gap-1.5">
                      {!isCommunityScope ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            className={cn(
                              "h-7 px-2.5 text-xs font-medium gap-1.5",
                              selected.is_active
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 hover:text-emerald-300"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                            onClick={() => void toggleActive(selected, !selected.is_active)}
                          >
                            {selected.is_active ? (
                              <>
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                On
                              </>
                            ) : (
                              <>
                                <span className="size-1.5 rounded-full bg-zinc-500" />
                                Paused
                              </>
                            )}
                          </Button>

                          {runningId === selected.id ? (
                            <Button variant="secondary" size="xs" disabled className="h-7 px-2 text-xs">
                              <Loader2 className="h-3 w-3 animate-spin" />
                            </Button>
                          ) : (
                            <Button variant="secondary" size="xs" onClick={() => void runNow(selected)} className="h-7 px-2.5 text-xs gap-1">
                              <Play className="h-3 w-3 fill-current" />
                              Run
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          {selected.user_id === userId ? (
                            <Button
                              size="xs"
                              className="h-7 px-2.5 text-xs"
                              onClick={() => {
                                const id = selected.id
                                setScope("mine")
                                lastHydratedId.current = null
                                setSelectedId(id)
                                setCommunityPreviewOpen(false)
                              }}
                            >
                              Edit
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              className="h-7 px-2.5 text-xs"
                              disabled={cloningId === selected.id}
                              onClick={() => void cloneFromCommunity(selected)}
                            >
                              Save
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <AutomationTabNav
                    activeTab={activeTab}
                    onSelect={setActiveTab}
                    variant="scroll"
                    isCommunity={isCommunityScope}
                  />
                </div>

                {/* Content area: Dynamic layout based on tab */}
                <div className={cn(
                  "min-h-0 min-w-0 flex-1 flex flex-col",
                  activeTab === "edit" ? "overflow-y-auto px-4 py-5 md:px-6 lg:px-5" : "h-full"
                )}>
                  {activeTab === "edit" && (
                    <>
                      <h2 className="mb-5 hidden text-base font-semibold text-foreground lg:block">
                        {isCommunityScope ? "Setup Details" : "Edit Setup"}
                      </h2>
                      <div className="space-y-4">
                        {renderAutomationFormFields("edit", {
                          readOnly: isCommunityScope,
                          showVisibility: !isCommunityScope,
                          showManualSaveActions: !isCommunityScope,
                        })}
                      </div>
                    </>
                  )}

                  {activeTab === "preview" && (
                    <div className="flex-1 flex flex-col min-h-0 h-full">
                      <div className="px-4 py-5 md:px-6 lg:px-5 pb-0 hidden lg:block">
                        <h2 className="text-base font-semibold text-foreground">Latest Preview</h2>
                      </div>
                      <div className="flex-1 min-h-0">
                        <AutomationPreviewTab
                          threadId={activeRunInfo?.automationId === selected.id ? (activeRunInfo.threadId ?? null) : (selected.latestRun?.thread_id ?? null)}
                          automationId={selected.id}
                          isCommunity={isCommunityScope}
                          hasPreview={selected.hasPreview ?? false}
                          activeRunId={activeRunInfo?.automationId === selected.id ? activeRunInfo.runId : null}
                          runTrigger="manual"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === "history" && !isCommunityScope && (
                    <div className="flex-1 flex flex-col min-h-0 h-full">
                      <div className="px-4 py-5 md:px-6 lg:px-5 pb-0 hidden lg:block">
                        <h2 className="text-base font-semibold text-foreground">Run History</h2>
                      </div>
                      <div className="flex-1 min-h-0">
                        <AutomationHistoryTab
                          runs={runs}
                          loadingRuns={loadingRuns}
                          automation={selected}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={newDialogOpen}
        onOpenChange={(open) => {
          setNewDialogOpen(open)
          if (!open) {
            lastHydratedId.current = null
            setVariablesDialogOpen(false)
          }
        }}
      >
        <DialogContent
          className={cn(
            AUTOMATION_SHEET_DIALOG_CLASSNAME,
            "overflow-y-auto sm:max-h-[min(90dvh,900px)] sm:!max-w-4xl",
          )}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>New automation</DialogTitle>
            <DialogDescription>
              Set up a task once and it will run on its own. Every run becomes a chat you can open to
              review the results or take them further.
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-6 px-4 py-4 sm:px-6">
            {renderAutomationFormFields("new", { readOnly: false, showVisibility: true, showInlineActions: true })}
          </div>
        </DialogContent>
      </Dialog>

      <AssetSelectionModal
        open={assetModalOpen}
        onOpenChange={(open) => {
          setAssetModalOpen(open)
          if (!open) setAssetPickerForVariable(null)
        }}
        onSelect={handleAssetLibrarySelect}
      />



      <AlertDialog open={unsavedCloseConfirmOpen} onOpenChange={setUnsavedCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes before closing?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this automation. Save them, discard them, or keep editing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isSaving}>Keep editing</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={discardEditAndClose}
            >
              Discard
            </Button>
            <Button type="button" disabled={isSaving} onClick={() => void saveAndCloseEdit()}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this automation?</AlertDialogTitle>
            <AlertDialogDescription>It will stop running from now on. You cannot undo this.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
