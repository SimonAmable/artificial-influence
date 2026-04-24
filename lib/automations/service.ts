import type { SupabaseClient } from "@supabase/supabase-js"

import {
  type AutomationPromptAttachment,
  type AutomationPromptPayload,
  normalizeAutomationPromptPayload,
} from "@/lib/automations/prompt-payload"
import {
  CRON_PRESET_HOURLY,
  computeNextRun,
  describeCronHumanSummary,
  validateCronExpression,
} from "@/lib/automations/schedule"
import { runAutomation } from "@/lib/automations/run"
import type { AutomationRow } from "@/lib/automations/types"
import { resolveChatGatewayModel } from "@/lib/constants/chat-llm-models"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { AttachedRef } from "@/lib/commands/types"

const DEFAULT_TIMEZONE = "UTC"
const WEEKDAY_ALIASES = new Map<string, number>([
  ["sun", 0],
  ["sunday", 0],
  ["mon", 1],
  ["monday", 1],
  ["tue", 2],
  ["tues", 2],
  ["tuesday", 2],
  ["wed", 3],
  ["wednesday", 3],
  ["thu", 4],
  ["thur", 4],
  ["thurs", 4],
  ["thursday", 4],
  ["fri", 5],
  ["friday", 5],
  ["sat", 6],
  ["saturday", 6],
])

export class AutomationServiceError extends Error {
  code: string
  status: number

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message)
    this.name = "AutomationServiceError"
    this.code = options?.code ?? "automation_error"
    this.status = options?.status ?? 400
  }
}

export function isAutomationServiceError(error: unknown): error is AutomationServiceError {
  return error instanceof AutomationServiceError
}

export type AutomationListItem = {
  id: string
  user_id: string
  name: string
  description: string | null
  prompt: string
  prompt_payload: AutomationPromptPayload | null
  cron_schedule: string
  scheduleSummary: string
  timezone: string
  model: string | null
  is_active: boolean
  last_run_at: string | null
  next_run_at: string
  run_count: number
  last_error: string | null
  is_public?: boolean
  preview_captured_at?: string | null
  preview_run_id?: string | null
  hasPreview: boolean
  latestRun: Record<string, unknown> | null
}

export type CreateAutomationInput = {
  name: string
  description?: string | null
  promptPayload: AutomationPromptPayload
  cronScheduleOrNaturalLanguage: string
  timezone?: string | null
  model?: string | null
  isActive?: boolean
}

export type UpdateAutomationInput = {
  name?: string
  description?: string | null
  promptPayload?: AutomationPromptPayload
  cronScheduleOrNaturalLanguage?: string
  timezone?: string | null
  model?: string | null
  isActive?: boolean
}

export type ResolvedAutomationSchedule = {
  cronSchedule: string
  nextRunAt: string
  source: "cron" | "natural_language"
  summary: string
  timezone: string
}

type TimeParts = { hour: number; minute: number }

function normalizeTimezone(value: string | null | undefined) {
  const timezone = value?.trim()
  return timezone && timezone.length > 0 ? timezone : DEFAULT_TIMEZONE
}

function normalizeDescription(value: string | null | undefined) {
  const description = value?.trim()
  return description && description.length > 0 ? description : null
}

function normalizeModel(value: string | null | undefined) {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? resolveChatGatewayModel(trimmed) : null
}

function hasPreviewSnapshot(previewThread: unknown): boolean {
  if (previewThread == null) return false
  if (Array.isArray(previewThread)) return previewThread.length > 0
  if (typeof previewThread === "object") return Object.keys(previewThread as object).length > 0
  return true
}

function normalizePromptPayloadInput(payload: AutomationPromptPayload): AutomationPromptPayload {
  return normalizeAutomationPromptPayload(payload.text, payload)
}

function parseClockTime(raw: string): TimeParts | null {
  const match = raw
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!match) return null

  let hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  const meridiem = match[3] ?? null

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) {
    return null
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    if (meridiem === "am") {
      hour = hour % 12
    } else {
      hour = hour % 12 + 12
    }
  } else if (hour < 0 || hour > 23) {
    return null
  }

  return { hour, minute }
}

function parseNaturalLanguageSchedule(input: string): { cronSchedule: string; ambiguous: boolean } | null {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ")
  if (!normalized) return null

  if (
    normalized === "hourly" ||
    normalized === "every hour" ||
    normalized === "every hourly"
  ) {
    return { cronSchedule: CRON_PRESET_HOURLY, ambiguous: false }
  }

  const weekdayAt = normalized.match(
    /^(?:every\s+)?(?:weekday|weekdays|mon-fri|monday through friday)(?:\s+at\s+(.+))?$/,
  )
  if (weekdayAt) {
    const time = weekdayAt[1] ? parseClockTime(weekdayAt[1]) : null
    if (!time) return { cronSchedule: "", ambiguous: true }
    return {
      cronSchedule: `0 ${time.minute} ${time.hour} * * 1-5`,
      ambiguous: false,
    }
  }

  const dailyAt = normalized.match(/^(?:every day|each day|daily)(?:\s+at\s+(.+))?$/)
  if (dailyAt) {
    const time = dailyAt[1] ? parseClockTime(dailyAt[1]) : null
    if (!time) return { cronSchedule: "", ambiguous: true }
    return {
      cronSchedule: `0 ${time.minute} ${time.hour} * * *`,
      ambiguous: false,
    }
  }

  const weeklyAt = normalized.match(
    /^(?:every|each|weekly on)\s+(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|rsday)?|fri(?:day)?|sat(?:urday)?)(?:\s+at\s+(.+))?$/,
  )
  if (weeklyAt) {
    const dayOfWeek = WEEKDAY_ALIASES.get(weeklyAt[1])
    const time = weeklyAt[2] ? parseClockTime(weeklyAt[2]) : null
    if (dayOfWeek == null || !time) {
      return { cronSchedule: "", ambiguous: true }
    }
    return {
      cronSchedule: `0 ${time.minute} ${time.hour} * * ${dayOfWeek}`,
      ambiguous: false,
    }
  }

  return null
}

export function resolveAutomationSchedule(input: {
  cronScheduleOrNaturalLanguage: string
  timezone?: string | null
  from?: Date
}): ResolvedAutomationSchedule {
  const raw = input.cronScheduleOrNaturalLanguage.trim()
  if (!raw) {
    throw new AutomationServiceError("A schedule is required.", {
      code: "schedule_required",
      status: 400,
    })
  }

  const timezone = normalizeTimezone(input.timezone)
  const from = input.from ?? new Date()

  try {
    validateCronExpression(raw, timezone)
    const nextRunAt = computeNextRun(raw, timezone, from).toISOString()
    return {
      cronSchedule: raw,
      nextRunAt,
      source: "cron",
      summary: describeCronHumanSummary(raw),
      timezone,
    }
  } catch {
    // Fall through to natural-language resolution.
  }

  const parsed = parseNaturalLanguageSchedule(raw)
  if (!parsed) {
    throw new AutomationServiceError(
      "Could not resolve that schedule. Use an hourly/daily/weekly phrase like \"daily at 9am\" or provide a 6-field cron expression.",
      {
        code: "schedule_unrecognized",
        status: 400,
      },
    )
  }

  if (parsed.ambiguous || !parsed.cronSchedule) {
    throw new AutomationServiceError(
      "That schedule is missing a clear run time. Say something like \"daily at 9am\" or \"every Monday at 14:30\".",
      {
        code: "schedule_ambiguous",
        status: 400,
      },
    )
  }

  try {
    validateCronExpression(parsed.cronSchedule, timezone)
  } catch (error) {
    throw new AutomationServiceError(
      error instanceof Error ? error.message : "Invalid schedule.",
      {
        code: "schedule_invalid",
        status: 400,
      },
    )
  }

  return {
    cronSchedule: parsed.cronSchedule,
    nextRunAt: computeNextRun(parsed.cronSchedule, timezone, from).toISOString(),
    source: "natural_language",
    summary: describeCronHumanSummary(parsed.cronSchedule),
    timezone,
  }
}

export async function getOwnedAutomationForUser(
  supabase: SupabaseClient,
  userId: string,
  automationId: string,
): Promise<AutomationRow> {
  const { data, error } = await supabase
    .from("automations")
    .select("*")
    .eq("id", automationId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) {
    throw new AutomationServiceError("Automation not found.", {
      code: "automation_not_found",
      status: 404,
    })
  }

  return data as AutomationRow
}

export async function listOwnedAutomations(
  supabase: SupabaseClient,
  userId: string,
): Promise<AutomationListItem[]> {
  const { data: rows, error } = await supabase
    .from("automations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    throw new AutomationServiceError(`Failed to load automations: ${error.message}`, {
      code: "automation_list_failed",
      status: 500,
    })
  }

  const automations = (rows ?? []) as AutomationRow[]
  const ids = automations.map((row) => row.id)
  const latestRuns = new Map<string, Record<string, unknown>>()

  if (ids.length > 0) {
    const { data: runRows, error: runError } = await supabase
      .from("automation_runs")
      .select("*")
      .in("automation_id", ids)
      .order("created_at", { ascending: false })

    if (runError) {
      throw new AutomationServiceError(`Failed to load automation runs: ${runError.message}`, {
        code: "automation_runs_list_failed",
        status: 500,
      })
    }

    for (const row of runRows ?? []) {
      const automationId = String(row.automation_id)
      if (!latestRuns.has(automationId)) {
        latestRuns.set(automationId, row as Record<string, unknown>)
      }
    }
  }

  return automations.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description ?? null,
    prompt: row.prompt,
    prompt_payload: row.prompt_payload ?? null,
    cron_schedule: row.cron_schedule,
    scheduleSummary: describeCronHumanSummary(row.cron_schedule),
    timezone: row.timezone,
    model: row.model ?? null,
    is_active: row.is_active,
    last_run_at: row.last_run_at,
    next_run_at: row.next_run_at,
    run_count: row.run_count,
    last_error: row.last_error,
    is_public: row.is_public,
    preview_captured_at: row.preview_captured_at ?? null,
    preview_run_id: row.preview_run_id ?? null,
    hasPreview: hasPreviewSnapshot(row.preview_thread),
    latestRun: latestRuns.get(row.id) ?? null,
  }))
}

export async function createAutomationForUser(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAutomationInput,
): Promise<AutomationRow> {
  const name = input.name.trim()
  if (!name) {
    throw new AutomationServiceError("A name is required.", {
      code: "automation_name_required",
      status: 400,
    })
  }

  const promptPayload = normalizePromptPayloadInput(input.promptPayload)
  if (!promptPayload.text.trim()) {
    throw new AutomationServiceError("A prompt is required.", {
      code: "automation_prompt_required",
      status: 400,
    })
  }

  const resolvedSchedule = resolveAutomationSchedule({
    cronScheduleOrNaturalLanguage: input.cronScheduleOrNaturalLanguage,
    timezone: input.timezone,
  })

  const { data, error } = await supabase
    .from("automations")
    .insert({
      user_id: userId,
      name,
      description: normalizeDescription(input.description),
      prompt: promptPayload.text,
      prompt_payload: promptPayload,
      cron_schedule: resolvedSchedule.cronSchedule,
      timezone: resolvedSchedule.timezone,
      model: normalizeModel(input.model),
      is_active: input.isActive ?? true,
      next_run_at: resolvedSchedule.nextRunAt,
      run_count: 0,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new AutomationServiceError(
      `Failed to create automation: ${error?.message ?? "Unknown error"}`,
      {
        code: "automation_create_failed",
        status: 500,
      },
    )
  }

  return data as AutomationRow
}

export async function updateAutomationForUser(
  supabase: SupabaseClient,
  userId: string,
  automationId: string,
  input: UpdateAutomationInput,
): Promise<AutomationRow> {
  const existing = await getOwnedAutomationForUser(supabase, userId, automationId)
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) {
      throw new AutomationServiceError("Automation name cannot be empty.", {
        code: "automation_name_invalid",
        status: 400,
      })
    }
    updates.name = name
  }

  if (input.description !== undefined) {
    updates.description = normalizeDescription(input.description)
  }

  if (input.promptPayload !== undefined) {
    const promptPayload = normalizePromptPayloadInput(input.promptPayload)
    if (!promptPayload.text.trim()) {
      throw new AutomationServiceError("Automation prompt cannot be empty.", {
        code: "automation_prompt_invalid",
        status: 400,
      })
    }
    updates.prompt = promptPayload.text
    updates.prompt_payload = promptPayload
  }

  let timezone = existing.timezone
  if (input.timezone !== undefined) {
    timezone = normalizeTimezone(input.timezone)
    updates.timezone = timezone
  }

  if (input.cronScheduleOrNaturalLanguage !== undefined) {
    const resolvedSchedule = resolveAutomationSchedule({
      cronScheduleOrNaturalLanguage: input.cronScheduleOrNaturalLanguage,
      timezone,
    })
    updates.cron_schedule = resolvedSchedule.cronSchedule
    updates.next_run_at = resolvedSchedule.nextRunAt
    updates.timezone = resolvedSchedule.timezone
  } else if (input.timezone !== undefined) {
    const resolvedSchedule = resolveAutomationSchedule({
      cronScheduleOrNaturalLanguage: existing.cron_schedule,
      timezone,
    })
    updates.next_run_at = resolvedSchedule.nextRunAt
  }

  if (input.model !== undefined) {
    updates.model = normalizeModel(input.model)
  }

  if (input.isActive !== undefined) {
    updates.is_active = input.isActive
    if (input.isActive) {
      updates.next_run_at = computeNextRun(
        String(updates.cron_schedule ?? existing.cron_schedule),
        String(updates.timezone ?? timezone),
        new Date(),
      ).toISOString()
    }
  }

  const keys = Object.keys(updates)
  if (keys.length === 1 && keys[0] === "updated_at") {
    throw new AutomationServiceError("No automation changes were provided.", {
      code: "automation_no_changes",
      status: 400,
    })
  }

  const { data, error } = await supabase
    .from("automations")
    .update(updates)
    .eq("id", automationId)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (error || !data) {
    throw new AutomationServiceError(
      `Failed to update automation: ${error?.message ?? "Unknown error"}`,
      {
        code: "automation_update_failed",
        status: 500,
      },
    )
  }

  return data as AutomationRow
}

export async function setAutomationActiveForUser(
  supabase: SupabaseClient,
  userId: string,
  automationId: string,
  isActive: boolean,
): Promise<AutomationRow> {
  return updateAutomationForUser(supabase, userId, automationId, { isActive })
}

export async function deleteAutomationForUser(
  supabase: SupabaseClient,
  userId: string,
  automationId: string,
): Promise<void> {
  await getOwnedAutomationForUser(supabase, userId, automationId)

  const { error } = await supabase
    .from("automations")
    .delete()
    .eq("id", automationId)
    .eq("user_id", userId)

  if (error) {
    throw new AutomationServiceError(`Failed to delete automation: ${error.message}`, {
      code: "automation_delete_failed",
      status: 500,
    })
  }
}

export async function runAutomationNowForUser(
  supabase: SupabaseClient,
  userId: string,
  automationId: string,
): Promise<{ runId: string; threadId: string }> {
  const automation = await getOwnedAutomationForUser(supabase, userId, automationId)
  const admin = createServiceRoleClient()

  if (!admin) {
    throw new AutomationServiceError("Server configuration error.", {
      code: "automation_run_config_missing",
      status: 500,
    })
  }

  const result = await runAutomation(admin, automation, { trigger: "manual" })
  if (!result.ok) {
    throw new AutomationServiceError(result.error, {
      code: "automation_run_failed",
      status: 500,
    })
  }

  return {
    runId: result.runId,
    threadId: result.threadId,
  }
}

export function mergeAutomationPromptPayload(input: {
  promptText?: string
  refs?: AttachedRef[]
  attachments?: AutomationPromptAttachment[]
  fallback?: AutomationPromptPayload | null
}): AutomationPromptPayload {
  const fallback = input.fallback ?? null
  const promptText = input.promptText?.trim()

  return {
    text: promptText ?? fallback?.text ?? "",
    refs: input.refs ?? fallback?.refs ?? [],
    attachments: input.attachments ?? fallback?.attachments ?? [],
    ...(input.fallback?.variables && input.fallback.variables.length > 0
      ? { variables: input.fallback.variables }
      : {}),
  }
}
