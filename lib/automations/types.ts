import type { AutomationPromptPayload } from "@/lib/automations/prompt-payload"

export type AutomationRow = {
  id: string
  user_id: string
  name: string
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
}

export type ChatThreadSource = "user" | "automation"
