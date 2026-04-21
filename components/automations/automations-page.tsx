"use client"

import * as React from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
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
  RefreshCw,
  Save,
  Star,
  Trash2,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { Collapsible as CollapsiblePrimitive } from "radix-ui"
import { AutomationRunPreviewModal } from "@/components/automations/automation-run-preview-modal"
import { Shimmer } from "@/components/ai-elements/shimmer"

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

function attachedRefFromAssetUrl(url: string, assetType: "audio" | "image" | "video"): AttachedRef {
  const chipId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const label =
    assetType === "image" ? "Reference image" : assetType === "video" ? "Reference video" : "Reference audio"
  return {
    id: chipId,
    label,
    category: "asset",
    assetType,
    assetUrl: url,
    previewUrl: url,
    serialized: `Reference (${assetType}) "${label}": ${url}`,
    chipId,
    mentionToken: "",
  }
}

export function AutomationsPage() {
  const [scope, setScope] = React.useState<"mine" | "community">("mine")
  const [userId, setUserId] = React.useState<string | null>(null)
  const [loadingAuth, setLoadingAuth] = React.useState(true)
  const [loadingList, setLoadingList] = React.useState(true)
  const [automations, setAutomations] = React.useState<AutomationApi[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [newDialogOpen, setNewDialogOpen] = React.useState(false)
  const [runs, setRuns] = React.useState<AutomationRunApi[]>([])
  const [loadingRuns, setLoadingRuns] = React.useState(false)
  const [editDetailsOpen, setEditDetailsOpen] = React.useState(false)

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
  const [saving, setSaving] = React.useState(false)
  const [variablesDialogOpen, setVariablesDialogOpen] = React.useState(false)
  const [editBaselineSnapshot, setEditBaselineSnapshot] = React.useState("")
  const needsEditBaselineCaptureRef = React.useRef(false)
  const [runningId, setRunningId] = React.useState<string | null>(null)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [isPublicAutomation, setIsPublicAutomation] = React.useState(false)
  const [cloningId, setCloningId] = React.useState<string | null>(null)
  const [settingPreviewRunId, setSettingPreviewRunId] = React.useState<string | null>(null)
  const [previewRunModal, setPreviewRunModal] = React.useState<{
    runId: string
    threadId: string | null
    status: "running" | "completed" | "failed"
    runTrigger: "manual" | "scheduled"
    error: string | null
  } | null>(null)
  const [communityPreviewOpen, setCommunityPreviewOpen] = React.useState(false)
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

  React.useEffect(() => {
    if (!activeRunInfo) return
    if (autoOpenedRunIdRef.current === activeRunInfo.runId) return
    autoOpenedRunIdRef.current = activeRunInfo.runId
    setPreviewRunModal({
      runId: activeRunInfo.runId,
      threadId: activeRunInfo.threadId,
      status: "running",
      runTrigger: "manual",
      error: null,
    })
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
  /* eslint-disable react-hooks/set-state-in-effect -- intentional data fetch after userId */
  React.useEffect(() => {
    if (userId) {
      void loadAutomations()
    }
  }, [userId, loadAutomations])
  /* eslint-enable react-hooks/set-state-in-effect */

  const goToCommunity = React.useCallback(() => {
    setSelectedId(null)
    lastHydratedId.current = null
    setCommunityPreviewOpen(false)
    setScope("community")
  }, [])

  const goToMine = React.useCallback(() => {
    setSelectedId(null)
    lastHydratedId.current = null
    setCommunityPreviewOpen(false)
    setScope("mine")
  }, [])

  React.useEffect(() => {
    if (scope === "community") {
      setNewDialogOpen(false)
    }
  }, [scope])

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

  /* eslint-disable react-hooks/set-state-in-effect -- fetch runs when selection changes */
  React.useEffect(() => {
    if (selectedId && !isCommunityScope) {
      void loadRuns(selectedId)
    } else {
      setRuns([])
    }
  }, [selectedId, loadRuns, isCommunityScope])
  /* eslint-enable react-hooks/set-state-in-effect */

  React.useEffect(() => {
    setEditDetailsOpen(false)
  }, [selectedId])

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
    setModel(a.model ?? DEFAULT_CHAT_GATEWAY_MODEL)
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
    ({ url, assetType }: AssetSelectionPick) => {
      if (assetPickerForVariable) {
        const base = attachedRefFromAssetUrl(url, assetType)
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
      setAttachedRefs((prev) => [...prev, attachedRefFromAssetUrl(url, assetType)])
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
    const vars = sanitizeAutomationVariables(automationVariables)
    return {
      text: prompt.trim(),
      refs: attachedRefs,
      attachments,
      ...(vars.length > 0 ? { variables: vars } : {}),
    }
  }, [prompt, attachedRefs, savedAttachments, uploadQueue, automationVariables])

  const persistSnapshot = React.useMemo(() => {
    if (!selected || newDialogOpen || isCommunityScope) return ""
    const cron = presetTab === "custom" ? customCron.trim() : effectiveCron
    return buildPersistSnapshot({
      name,
      description,
      promptPayload: currentPromptPayload,
      cronSchedule: cron,
      timezone,
      model,
      isPublic: isPublicAutomation,
    })
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

  const isEditHydrationPending = Boolean(
    selected && selectedId && lastHydratedId.current !== selectedId,
  )
  const hasUnsavedFormEdits =
    !isCommunityScope &&
    Boolean(selected) &&
    !newDialogOpen &&
    !isEditHydrationPending &&
    persistSnapshot.length > 0 &&
    editBaselineSnapshot.length > 0 &&
    persistSnapshot !== editBaselineSnapshot

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
    setCommunityPreviewOpen(false)
  }, [selectedId, selected, hydrateFromAutomation])

  const save = async () => {
    if (isCommunityScope) return
    if (!name.trim() || !prompt.trim()) {
      toast.error("Title and prompt are required")
      return
    }
    if (uploadQueue.some((u) => u.isUploading)) {
      toast.error("Wait for uploads to finish")
      return
    }
    const cron = presetTab === "custom" ? customCron.trim() : effectiveCron
    if (!cron) {
      toast.error("Schedule is required")
      return
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
    setSaving(true)
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
        lastHydratedId.current = null
        await loadAutomations()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
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
    opts: { readOnly?: boolean; showVisibility?: boolean } = {},
  ) {
    const readOnly = opts.readOnly ?? false
    const showVisibility = opts.showVisibility ?? false
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
      <fieldset disabled={readOnly} className="min-w-0 border-0 p-0 disabled:opacity-[0.92]">
      <div className="overflow-hidden rounded-[30px] border border-border/60 bg-background/95 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.7)]">
      <div className="space-y-4 px-5 pt-5 sm:px-6 sm:pt-6">
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
            className="h-auto border-0 bg-transparent px-0 text-lg font-semibold shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-0 md:text-xl"
          />
          <p className="text-xs text-muted-foreground">
            Keep the title short. The prompt does the heavy lifting.
          </p>
        </div>
        {(savedAttachments.length > 0 || uploadQueue.length > 0) && (
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
          <CommandTextarea
            value={prompt}
            onChange={setPrompt}
            refs={attachedRefs}
            onRefsChange={setAttachedRefs}
            rows={10}
            className="min-h-[240px] max-h-[420px] rounded-none border-0 bg-transparent px-0 py-0 font-mono text-sm leading-6 shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-0"
            placeholder="Add prompt e.g. create tomorrow's post ideas, captions, and image directions. Type / for templates, @ for brands and assets."
            slashCommands={AUTOMATION_SLASH_COMMANDS}
            slashCommandsContext="Automation"
            onPasteImage={(file) => void handleAttachFiles([file])}
          />
        </div>
      </div>

      <div className="border-t border-border/50 px-4 py-3 sm:px-6">
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
                  const opt = CHAT_GATEWAY_MODEL_OPTIONS.find((option) => option.id === model)
                  return (
                    <div className="flex items-center gap-2">
                      <ModelIcon identifier={model} size={14} />
                      <span>{opt?.label ?? model}</span>
                    </div>
                  )
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" side="top" sideOffset={6}>
              {CHAT_GATEWAY_MODEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 rounded-md border border-border bg-muted/30 p-1.5">
                      <ModelIcon identifier={opt.id} size={18} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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

          {showVisibility ? (
            <div className="ml-auto flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5">
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
              <span>Pick a schedule to see when it'll run next.</span>
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 px-4 pb-12 pt-20 md:flex-row md:gap-6">
      <aside className="w-full shrink-0 md:w-80">
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold">
            {scope === "community" ? "Community Automations" : "My Automations"}
          </h1>
          <div className="flex flex-wrap justify-start gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => void loadAutomations()} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {scope === "mine" ? (
              <>
                <Button variant="outline" size="sm" onClick={goToCommunity}>
                  <Globe className="mr-1 h-4 w-4" />
                  View Community
                </Button>
                <Button size="sm" onClick={resetFormForNew}>
                  <Plus className="mr-1 h-4 w-4" />
                  New
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={goToMine}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Mine
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="mt-4 h-[calc(100dvh-10rem)] pr-2">
          {loadingList ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : automations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {scope === "community"
                ? "Nothing shared here yet. Check back soon."
                : "Nothing on autopilot yet. Hit New to set up a recurring task."}
            </p>
          ) : (
            <ul className="space-y-2">
              {automations.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setNewDialogOpen(false)
                      setSelectedId(a.id)
                    }}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                      selectedId === a.id
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/60 bg-background hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 font-medium">{a.name}</span>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        {scope === "community" ? (
                          <>
                            {a.user_id === userId ? (
                              <Badge variant="default" className="text-[10px]">
                                Yours
                              </Badge>
                            ) : null}
                            {a.hasPreview ? (
                              <Badge variant="outline" className="text-[10px]">
                                Preview
                              </Badge>
                            ) : null}
                          </>
                        ) : (
                          <>
                            {a.is_public === true ? (
                              <Badge variant="outline" className="text-[10px]">
                                Public
                              </Badge>
                            ) : null}
                            <Badge variant={a.is_active ? "default" : "secondary"} className="text-[10px]">
                              {a.is_active ? "On" : "Off"}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    {a.description?.trim() ? (
                      <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
                        {a.description.trim()}
                      </p>
                    ) : null}
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {describeCronHumanSummary(a.cron_schedule)}
                    </p>
                    {scope === "mine" && a.last_error ? (
                      <p className="mt-1 truncate text-xs text-destructive">{a.last_error}</p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-4">
        {!selectedId || !selected ? (
          <Card className="border-dashed py-4">
            <CardHeader>
              <CardTitle>Pick one or start fresh</CardTitle>
              <CardDescription>
                Open an automation from the list to edit it, or hit <strong>New</strong> to set up a task
                that runs on its own: daily ideas, weekly reports, hourly scans, whatever you need.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <Card className="py-4">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>{selected.name}</CardTitle>
                {selected.description?.trim() ? (
                  <p className="mt-1 whitespace-pre-line text-sm leading-snug text-muted-foreground">
                    {selected.description.trim()}
                  </p>
                ) : null}
                <CardDescription>
                  Runs on its own, on the schedule you pick. Each run becomes a chat you can open to see
                  the results, tweak the prompt, or run it again right away.
                </CardDescription>
                {isCommunityScope ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {selected.hasPreview
                      ? "Preview available. Open it to see what a run actually looks like."
                      : "No preview yet. This automation hasn't shared a sample run."}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isCommunityScope ? (
                  <>
                    <Button
                      variant={editDetailsOpen ? "secondary" : "outline"}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setEditDetailsOpen((o) => !o)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {editDetailsOpen ? "Hide details" : "Details"}
                      <ChevronDown
                        className={cn("h-3.5 w-3.5 transition-transform", editDetailsOpen && "rotate-180")}
                      />
                    </Button>
                    <Badge variant="outline" className="text-xs">
                      Public
                    </Badge>
                    {selected.user_id === userId ? (
                      <Badge variant="default" className="text-xs">
                        Yours
                      </Badge>
                    ) : null}
                    {selected.hasPreview ? (
                      <Badge variant="secondary" className="text-xs">
                        Preview
                      </Badge>
                    ) : null}
                    {selected.user_id === userId ? (
                      <Button
                        size="sm"
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
                        disabled={cloningId === selected.id}
                        onClick={() => void cloneFromCommunity(selected)}
                      >
                        {cloningId === selected.id ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : null}
                        Save to my automations
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!selected.hasPreview}
                      onClick={() => openCommunityPreview(selected)}
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      Open preview
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant={editDetailsOpen ? "secondary" : "outline"}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setEditDetailsOpen((o) => !o)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {editDetailsOpen ? "Hide edit" : "Edit"}
                      <ChevronDown
                        className={cn("h-3.5 w-3.5 transition-transform", editDetailsOpen && "rotate-180")}
                      />
                    </Button>
                    {hasUnsavedFormEdits ? (
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5 shadow-sm"
                        disabled={saving}
                        onClick={() => void save()}
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Save edits
                      </Button>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={selected.is_active}
                        onCheckedChange={(v) => void toggleActive(selected, v)}
                        id="active-switch"
                      />
                      <Label htmlFor="active-switch" className="text-sm">
                        Active
                      </Label>
                    </div>
                    {canShowViewSetPreview && selected.preview_run_id ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const previewRunId = selected.preview_run_id
                          if (!previewRunId) return
                          const row = runs.find((r) => r.id === previewRunId)
                          const st = row?.status
                          const status: "running" | "completed" | "failed" =
                            st === "failed" ? "failed" : st === "running" ? "running" : "completed"
                          setPreviewRunModal({
                            runId: previewRunId,
                            threadId: row?.thread_id ?? null,
                            status,
                            runTrigger: (row?.run_trigger ?? "scheduled") as "manual" | "scheduled",
                            error: row?.error ?? null,
                          })
                        }}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        View preview
                      </Button>
                    ) : null}
                    {showViewLastManualBtn && pendingManualForSelected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPreviewRunModal({
                            runId: pendingManualForSelected.runId,
                            threadId: pendingManualForSelected.threadId,
                            status: pendingManualForSelected.status,
                            runTrigger: "manual",
                            error: pendingManualForSelected.error,
                          })
                        }
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        View last run
                      </Button>
                    ) : null}
                    {runningId === selected.id ? (
                      (() => {
                        const activeForSelected =
                          activeRunInfo?.automationId === selected.id ? activeRunInfo : null
                        const viewReady = Boolean(activeForSelected)
                        return (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!viewReady}
                            onClick={() => {
                              if (!activeForSelected) return
                              setPreviewRunModal({
                                runId: activeForSelected.runId,
                                threadId: activeForSelected.threadId,
                                status: "running",
                                runTrigger: "manual",
                                error: null,
                              })
                            }}
                          >
                            {viewReady ? (
                              <Eye className="mr-1 h-4 w-4" />
                            ) : (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            )}
                            {viewReady ? (
                              <Shimmer as="span" duration={2} spread={3}>
                                View current run
                              </Shimmer>
                            ) : (
                              "Starting…"
                            )}
                          </Button>
                        )
                      })()
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void runNow(selected)}
                      >
                        <Play className="mr-1 h-4 w-4" />
                        Run now
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setDeleteId(selected.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CollapsiblePrimitive.Root open={editDetailsOpen} onOpenChange={setEditDetailsOpen}>
                <CollapsiblePrimitive.Content
                  className={cn(
                    "overflow-hidden text-sm transition-all data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1",
                    "data-[state=closed]:hidden",
                  )}
                >
                  <div className="space-y-6 border-t border-border/40 pt-6">
                    <div className="space-y-6">
                      {renderAutomationFormFields("edit", {
                        readOnly: isCommunityScope,
                        showVisibility: !isCommunityScope,
                      })}
                    </div>

                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                      {selected.next_run_at ? (
                        <p>
                          <span className="text-muted-foreground">Next scheduled:</span>{" "}
                          {new Date(selected.next_run_at).toLocaleString(undefined, {
                            timeZone: timezone,
                          })}
                        </p>
                      ) : null}
                      {selected.last_run_at ? (
                        <p className="mt-1">
                          <span className="text-muted-foreground">Last run:</span>{" "}
                          {formatDistanceToNow(new Date(selected.last_run_at), { addSuffix: true })}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Schedule:{" "}
                        <code className="rounded bg-muted px-1">{selected.cron_schedule}</code>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Timezone:{" "}
                        <span className="font-mono text-foreground/80">{timezone}</span>
                        {!isCommunityScope ? (
                          <>
                            {" · "}
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
                                  <Label htmlFor="edit-tz-popover" className="text-xs">
                                    Timezone
                                  </Label>
                                  <Select value={timezone} onValueChange={setTimezone}>
                                    <SelectTrigger
                                      id="edit-tz-popover"
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
                      </p>
                    </div>

                    {!isCommunityScope ? (
                      <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <p className="text-sm text-muted-foreground">
                          Changes are kept only after you save.
                        </p>
                        <Button
                          type="button"
                          size="lg"
                          className="w-full shadow-sm sm:w-auto"
                          onClick={() => void save()}
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Save changes
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CollapsiblePrimitive.Content>
              </CollapsiblePrimitive.Root>
            </CardContent>
            </Card>

            {!isCommunityScope ? (
              <Card className="py-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Recent runs</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {loadingRuns ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : runs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No runs yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {runs.map((r) => {
                        const isCurrentPreview =
                          selected.is_public === true && selected.preview_run_id === r.id
                        const canSetAsPreview =
                          selected.is_public === true &&
                          r.status === "completed" &&
                          Boolean(r.thread_id) &&
                          !isCurrentPreview
                        const isSettingThis = settingPreviewRunId === r.id
                        return (
                          <li
                            key={r.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={
                                  r.status === "completed"
                                    ? "default"
                                    : r.status === "failed"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {r.status}
                              </Badge>
                              <Badge
                                variant={(r.run_trigger ?? "scheduled") === "manual" ? "outline" : "secondary"}
                                className="text-[10px]"
                              >
                                {(r.run_trigger ?? "scheduled") === "manual" ? "Manual" : "Scheduled"}
                              </Badge>
                              {isCurrentPreview ? (
                                <Badge variant="outline" className="gap-1 text-[10px]">
                                  <Star className="h-3 w-3 fill-current" />
                                  Current preview
                                </Badge>
                              ) : null}
                              <span className="text-xs text-muted-foreground">
                                {new Date(r.started_at).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() =>
                                  setPreviewRunModal({
                                    runId: r.id,
                                    threadId: r.thread_id,
                                    status: r.status as "running" | "completed" | "failed",
                                    runTrigger: (r.run_trigger ?? "scheduled") as "manual" | "scheduled",
                                    error: r.error,
                                  })
                                }
                              >
                                <Eye className="mr-1 h-3.5 w-3.5" />
                                Preview
                              </Button>
                              {r.thread_id ? (
                                <Link
                                  href={`/chat/${r.thread_id}`}
                                  className="text-xs font-medium text-primary hover:underline"
                                >
                                  Open thread
                                </Link>
                              ) : null}
                              {canSetAsPreview ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isSettingThis || settingPreviewRunId !== null}
                                  onClick={() => void setCommunityPreviewRun(selected.id, r.id)}
                                >
                                  {isSettingThis ? (
                                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Star className="mr-1 h-3.5 w-3.5" />
                                  )}
                                  Set as preview
                                </Button>
                              ) : null}
                            </div>
                            {r.error ? <p className="w-full text-xs text-destructive">{r.error}</p> : null}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </main>

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
        <DialogContent className="max-h-[min(90dvh,900px)] gap-0 overflow-y-auto sm:max-w-4xl">
          <DialogHeader className="sr-only">
            <DialogTitle>New automation</DialogTitle>
            <DialogDescription>
              Set up a task once and it'll run on its own. Every run becomes a chat you can open to
              review the results or take them further.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {renderAutomationFormFields("new", { readOnly: false, showVisibility: true })}
          </div>
          <DialogFooter className="gap-2 border-t border-border/60 pt-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
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

      {selected && previewRunModal ? (
        <AutomationRunPreviewModal
          key={previewRunModal.runId}
          open
          onOpenChange={(o) => {
            if (!o) setPreviewRunModal(null)
          }}
          automationId={selected.id}
          automationName={selected.name}
          runId={previewRunModal.runId}
          initialThreadId={previewRunModal.threadId}
          initialStatus={previewRunModal.status}
          promptPreview={prompt.trim() || null}
          templatePayload={previewTemplatePayload}
          runTrigger={previewRunModal.runTrigger}
          initialRunError={previewRunModal.error}
        />
      ) : null}

      {selected && isCommunityScope && communityPreviewOpen ? (
        <AutomationRunPreviewModal
          key={`community-${selected.id}`}
          open
          onOpenChange={(o) => {
            if (!o) setCommunityPreviewOpen(false)
          }}
          automationId={selected.id}
          automationName={selected.name}
          runId=""
          source="community"
          promptPreview={selected.prompt.trim() || null}
          templatePayload={previewTemplatePayload}
        />
      ) : null}

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this automation?</AlertDialogTitle>
            <AlertDialogDescription>It'll stop running from now on. You can't undo this.</AlertDialogDescription>
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
