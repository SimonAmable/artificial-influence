"use client"

import * as React from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { FilePlus, FolderOpen, Plus as PlusPhosphor } from "@phosphor-icons/react"
import { ArrowLeft, Clock, Eye, Globe, Loader2, Play, Plus, RefreshCw, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { AssetSelectionModal } from "@/components/shared/modals/asset-selection-modal"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group"
import { AUTOMATION_SLASH_COMMANDS } from "@/lib/commands/presets-automation"
import type { AttachedRef } from "@/lib/commands/types"
import type { AutomationPromptAttachment, AutomationPromptPayload } from "@/lib/automations/prompt-payload"
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
import { AutomationRunPreviewModal } from "@/components/automations/automation-run-preview-modal"

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

  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [prompt, setPrompt] = React.useState("")
  const [attachedRefs, setAttachedRefs] = React.useState<AttachedRef[]>([])
  const [savedAttachments, setSavedAttachments] = React.useState<AutomationPromptAttachment[]>([])
  const [uploadQueue, setUploadQueue] = React.useState<AutomationPendingUpload[]>([])
  const [assetModalOpen, setAssetModalOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [timezone, setTimezone] = React.useState(() => getDefaultTimeZone())
  const ianaZones = React.useMemo(() => listIanaTimeZones(), [])
  const [model, setModel] = React.useState<string>(DEFAULT_CHAT_GATEWAY_MODEL)
  const [presetTab, setPresetTab] = React.useState<"presets" | "custom">("presets")
  const [presetKind, setPresetKind] = React.useState<InferredPreset["kind"]>("hourly")
  const [dailyHour, setDailyHour] = React.useState(9)
  const [dailyMinute, setDailyMinute] = React.useState(0)
  const [weeklyDow, setWeeklyDow] = React.useState(1)
  const [weeklyHour, setWeeklyHour] = React.useState(9)
  const [weeklyMinute, setWeeklyMinute] = React.useState(0)
  const [customCron, setCustomCron] = React.useState(CRON_PRESET_HOURLY)
  const [nextPreview, setNextPreview] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
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
    setTimezone(getDefaultTimeZone())
    setModel(DEFAULT_CHAT_GATEWAY_MODEL)
    setPresetTab("presets")
    setPresetKind("hourly")
    setDailyHour(9)
    setDailyMinute(0)
    setWeeklyDow(1)
    setWeeklyHour(9)
    setWeeklyMinute(0)
    setCustomCron(CRON_PRESET_HOURLY)
    setIsPublicAutomation(false)
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
    } else {
      setPrompt(a.prompt)
      setAttachedRefs([])
      setSavedAttachments([])
    }
    setUploadQueue([])
    setTimezone(a.timezone || getDefaultTimeZone())
    setModel(a.model ?? DEFAULT_CHAT_GATEWAY_MODEL)
    setIsPublicAutomation(a.is_public === true)
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

  const handleAssetLibrarySelect = React.useCallback((imageUrl: string) => {
    setAttachedRefs((prev) => [...prev, attachedRefFromAssetUrl(imageUrl, "image")])
    setAssetModalOpen(false)
  }, [])

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
      toast.error("Name and prompt are required")
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
    }
    setSaving(true)
    try {
      if (newDialogOpen) {
        const res = await fetch("/api/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
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
            description: description.trim() || null,
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
      toast.success("Saved — edit and run from Mine")
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
    return (
      <>
      <fieldset disabled={readOnly} className="min-w-0 space-y-6 border-0 p-0 disabled:opacity-[0.92]">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Morning asset batch"
          disabled={readOnly}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <p className="text-xs text-muted-foreground">Optional — for your reference only; not sent to the agent.</p>
        <Textarea
          id={`${idPrefix}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this automation is for…"
          rows={2}
          className="min-h-[72px] resize-y"
          disabled={readOnly}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-prompt`}>Prompt</Label>
        <p className="text-xs text-muted-foreground">
          Press <kbd className="rounded border bg-muted px-1">/</kbd> to browse prompt templates,{" "}
          <kbd className="rounded border bg-muted px-1">@</kbd> to drop in brand kits or saved assets, and{" "}
          <kbd className="rounded border bg-muted px-1">+</kbd> to upload your own files.
        </p>
        {(savedAttachments.length > 0 || uploadQueue.length > 0) && (
          <div className="flex flex-row flex-wrap gap-2">
            {savedAttachments.map((att) => {
              const kind = mediaKindFromMime(att.mediaType)
              return (
                <div key={att.url} className="relative">
                  {kind === "image" ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-muted/40">
                      <img src={att.url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : kind === "video" ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-muted/40">
                      <video src={att.url} muted playsInline className="h-full w-full object-cover" />
                    </div>
                  ) : kind === "audio" ? (
                    <div className="flex h-16 min-w-[160px] max-w-[200px] items-center rounded-lg border border-border bg-muted/40 px-2">
                      <audio src={att.url} controls className="h-8 w-full" />
                    </div>
                  ) : (
                    <Badge variant="outline" className="max-w-[200px] truncate">
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
              <div key={u.id} className="relative inline-flex max-w-[220px] items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5 pr-7 text-xs">
                <span className="truncate" title={u.file.name}>
                  {u.file.name}
                </span>
                {u.isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : null}
                <button
                  type="button"
                  disabled={readOnly}
                  className="absolute -top-1.5 -right-1.5 z-10 rounded-full border border-border bg-background p-1 shadow-sm hover:bg-destructive hover:text-destructive-foreground disabled:pointer-events-none disabled:opacity-50"
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
        <InputGroup className="items-end rounded-[22px] border-border/60 bg-background/95 p-1 shadow-sm has-[textarea]:rounded-[22px]">
          <CommandTextarea
            value={prompt}
            onChange={setPrompt}
            refs={attachedRefs}
            onRefsChange={setAttachedRefs}
            rows={6}
            className="min-h-[120px] max-h-[220px] flex-1 px-3 py-2 font-mono text-sm"
            placeholder="Instructions for the agent. Type / for templates, @ for brands and assets."
            slashCommands={AUTOMATION_SLASH_COMMANDS}
            slashCommandsContext="Automation"
            onPasteImage={(file) => void handleAttachFiles([file])}
          />
          <InputGroupAddon align="block-end" className="justify-start gap-2 border-t border-border/40 pt-1.5">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Attach files or assets">
                  <PlusPhosphor className="h-4 w-4" />
                  <span className="sr-only">Attach</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" sideOffset={4}>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <FilePlus className="mr-2 size-4" />
                  Upload files
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAssetModalOpen(true)}>
                  <FolderOpen className="mr-2 size-4" />
                  Select asset
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-tz`}>Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone} disabled={readOnly}>
            <SelectTrigger id={`${idPrefix}-tz`} className="w-full font-mono text-xs">
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
        <div className="space-y-2">
          <Label>Model</Label>
          <Select value={model} onValueChange={setModel} disabled={readOnly}>
            <SelectTrigger id={`${idPrefix}-model`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHAT_GATEWAY_MODEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showVisibility ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
            <div className="space-y-0.5">
              <Label htmlFor={`${idPrefix}-is-public`} className="text-sm">
                Public in Community
              </Label>
              <p className="text-xs text-muted-foreground">
                When on, others can browse, preview, and clone this automation.
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
              First successful run will be snapshotted so others can preview this automation in Community.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <Label>Schedule</Label>
        <Tabs value={presetTab} onValueChange={(v) => setPresetTab(v as "presets" | "custom")}>
          <TabsList>
            <TabsTrigger value="presets">Presets</TabsTrigger>
            <TabsTrigger value="custom">Custom cron</TabsTrigger>
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
              Six fields: second minute hour day month weekday. Example hourly: <code>0 0 * * * *</code>
            </p>
          </TabsContent>
        </Tabs>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {nextPreview ? (
            <span>
              Next run (approx): <strong className="text-foreground">{nextPreview}</strong>
            </span>
          ) : (
            <span>Enter a valid schedule to preview next run.</span>
          )}
        </div>
      </div>
      </fieldset>
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
        <p className="mt-2 text-muted-foreground">Sign in to schedule agent prompts on a cron.</p>
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
                ? "No public automations from other users yet."
                : "No automations yet. Create one to run your agent on a schedule."}
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
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.description.trim()}</p>
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

      <main className="min-w-0 flex-1">
        {!selectedId || !selected ? (
          <Card className="border-dashed py-4">
            <CardHeader>
              <CardTitle>Select or create</CardTitle>
              <CardDescription>
                Pick an automation from the list or use <strong>New</strong> to add a scheduled prompt.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card className="py-4">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>{selected.name}</CardTitle>
                {selected.description?.trim() ? (
                  <p className="mt-1 text-sm leading-snug text-muted-foreground">{selected.description.trim()}</p>
                ) : null}
                <CardDescription>
                  Put your creative work on autopilot. Every run kicks off a fresh conversation you can open
                  anytime to review results or keep iterating.
                </CardDescription>
                {isCommunityScope ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {selected.hasPreview
                      ? "Preview available — open to see an example run in chat."
                      : "No preview yet — the owner has not completed a successful public run."}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isCommunityScope ? (
                  <>
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
                            {viewReady ? "View current run" : "Starting…"}
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
            <CardContent className="space-y-6">
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
                    {new Date(selected.next_run_at).toLocaleString()}
                  </p>
                ) : null}
                {selected.last_run_at ? (
                  <p className="mt-1">
                    <span className="text-muted-foreground">Last run:</span>{" "}
                    {formatDistanceToNow(new Date(selected.last_run_at), { addSuffix: true })}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Cron: <code className="rounded bg-muted px-1">{selected.cron_schedule}</code>
                </p>
              </div>

              {!isCommunityScope ? (
                <div className="flex gap-2">
                  <Button onClick={() => void save()} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              ) : null}

              {!isCommunityScope ? (
              <div className="space-y-2 border-t pt-6">
                <h3 className="text-sm font-semibold">Recent runs</h3>
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
                            <Badge variant={r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
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
              </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog
        open={newDialogOpen}
        onOpenChange={(open) => {
          setNewDialogOpen(open)
          if (!open) {
            lastHydratedId.current = null
          }
        }}
      >
        <DialogContent className="max-h-[min(90dvh,900px)] gap-0 overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New automation</DialogTitle>
            <DialogDescription>
              Put your creative work on autopilot. Every run kicks off a fresh conversation you can open
              anytime to review results or keep iterating.
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

      <AssetSelectionModal open={assetModalOpen} onOpenChange={setAssetModalOpen} onSelect={handleAssetLibrarySelect} />

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
          promptPreview={prompt.trim() || null}
        />
      ) : null}

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete automation?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Scheduled runs will stop.</AlertDialogDescription>
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
