import type { AutomationPromptPayload } from "@/lib/automations/prompt-payload"

export type AutomationRunTrigger = "manual" | "scheduled"

export type AutomationRow = {
  id: string
  user_id: string
  name: string
  /** Optional label for humans; not sent to the agent as the prompt. */
  description?: string | null
  prompt: string
  prompt_payload?: AutomationPromptPayload | null
  cron_schedule: string
  timezone: string
  model: string | null
  is_active: boolean
  last_run_at: string | null
  next_run_at: string
  run_count: number
  last_error: string | null
  created_at: string
  updated_at: string
  /** Default false (private). When true, automation is listed in Community. */
  is_public?: boolean
  preview_thread?: unknown | null
  preview_captured_at?: string | null
  preview_run_id?: string | null
  cloned_from?: string | null
}

export type AutomationRunRow = {
  id: string
  automation_id: string
  user_id: string
  thread_id: string | null
  status: "running" | "completed" | "failed"
  started_at: string
  finished_at: string | null
  error: string | null
  created_at: string
  run_trigger?: AutomationRunTrigger
}

export type ChatThreadSource = "user" | "automation"
