import { normalizeAutomationPromptPayload, type AutomationPromptPayload } from "@/lib/automations/prompt-payload"
import type { AutomationRow } from "@/lib/automations/types"

export const ONBOARDING_LEARN_AUTOMATION_ID = "61206acb-91fd-4aae-a308-2d597b7f253d" as const

export type OnboardingLearnAutomation = {
  id: string
  userId: string
  name: string
  description: string | null
  prompt: string
  promptPayload: AutomationPromptPayload
  cronSchedule: string
  timezone: string
  model: string | null
  isActive: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  runCount: number
  lastError: string | null
  createdAt: string
  updatedAt: string
  isPublic: boolean
  previewCapturedAt: string | null
  clonedFrom: string | null
  previewRunId: string | null
}

const FALLBACK_PROMPT_PAYLOAD: AutomationPromptPayload = {
  refs: [],
  text:
    "3 different angle/pose differnt clothing front facing camera selfie shots in a existing bedroom only pick 1 scene.  for 1 carosel instragram post, start by generating a front facing selfie with my and new random sexy slightly revealing cute fashion nova outfit with reference and they make 2 more images of same scene using the first generation as reference with very small changes, like a head tilt, slightly diff pose, diff expressions or diff angle, but same scene then save as draft posts to instagram carosel for bscodeinsiders, infer nesacary details to complete all 3 generations and draft posts without approval",
  attachments: [
    {
      url: "https://yjhdsknmikbaulrgusfr.supabase.co/storage/v1/object/public/public-bucket/34e26aab-d98a-425e-af89-9726776a3827/chat-user-uploads/1776516241325-hh7q3d.png",
      filename: "hf_20260328_144002_9aa0b242-c8e5-43e0-9444-a5dc16938b89.png",
      mediaType: "image/png",
    },
  ],
}

export const FALLBACK_ONBOARDING_LEARN_AUTOMATION: OnboardingLearnAutomation = {
  id: ONBOARDING_LEARN_AUTOMATION_ID,
  userId: "34e26aab-d98a-425e-af89-9726776a3827",
  name: "AI influener daily post",
  description:
    "This automation helps your ai influencer consistently post one 3 image carosel a day on Instagram AUTOMATICLY.",
  prompt: FALLBACK_PROMPT_PAYLOAD.text,
  promptPayload: FALLBACK_PROMPT_PAYLOAD,
  cronSchedule: "0 0 9 * * *",
  timezone: "America/Toronto",
  model: "xai/grok-4.1-fast-non-reasoning",
  isActive: true,
  lastRunAt: "2026-04-19 04:41:05.641+00",
  nextRunAt: "2026-04-19 13:00:00+00",
  runCount: 8,
  lastError: null,
  createdAt: "2026-04-18 12:46:01.240672+00",
  updatedAt: "2026-04-19 04:47:12.424+00",
  isPublic: true,
  previewCapturedAt: "2026-04-19 04:42:20.257+00",
  clonedFrom: null,
  previewRunId: "6963531a-cb72-42d3-a2ce-af538d652ad2",
}

export function mapAutomationRowToOnboardingLearnAutomation(
  row: Partial<AutomationRow> | null | undefined,
): OnboardingLearnAutomation {
  if (!row) return FALLBACK_ONBOARDING_LEARN_AUTOMATION

  const prompt =
    typeof row.prompt === "string" && row.prompt.trim().length > 0
      ? row.prompt
      : FALLBACK_ONBOARDING_LEARN_AUTOMATION.prompt
  const promptPayload = normalizeAutomationPromptPayload(
    prompt,
    row.prompt_payload ?? FALLBACK_ONBOARDING_LEARN_AUTOMATION.promptPayload,
  )

  return {
    id: typeof row.id === "string" ? row.id : FALLBACK_ONBOARDING_LEARN_AUTOMATION.id,
    userId:
      typeof row.user_id === "string" ? row.user_id : FALLBACK_ONBOARDING_LEARN_AUTOMATION.userId,
    name: typeof row.name === "string" ? row.name : FALLBACK_ONBOARDING_LEARN_AUTOMATION.name,
    description:
      typeof row.description === "string"
        ? row.description
        : FALLBACK_ONBOARDING_LEARN_AUTOMATION.description,
    prompt,
    promptPayload,
    cronSchedule:
      typeof row.cron_schedule === "string"
        ? row.cron_schedule
        : FALLBACK_ONBOARDING_LEARN_AUTOMATION.cronSchedule,
    timezone:
      typeof row.timezone === "string" ? row.timezone : FALLBACK_ONBOARDING_LEARN_AUTOMATION.timezone,
    model:
      typeof row.model === "string" || row.model === null
        ? row.model
        : FALLBACK_ONBOARDING_LEARN_AUTOMATION.model,
    isActive: typeof row.is_active === "boolean" ? row.is_active : FALLBACK_ONBOARDING_LEARN_AUTOMATION.isActive,
    lastRunAt:
      typeof row.last_run_at === "string" || row.last_run_at === null
        ? row.last_run_at
        : FALLBACK_ONBOARDING_LEARN_AUTOMATION.lastRunAt,
    nextRunAt:
      typeof row.next_run_at === "string" || row.next_run_at === null
        ? row.next_run_at
        : FALLBACK_ONBOARDING_LEARN_AUTOMATION.nextRunAt,
    runCount:
      typeof row.run_count === "number" ? row.run_count : FALLBACK_ONBOARDING_LEARN_AUTOMATION.runCount,
    lastError:
      typeof row.last_error === "string" || row.last_error === null
        ? row.last_error
        : FALLBACK_ONBOARDING_LEARN_AUTOMATION.lastError,
    createdAt:
      typeof row.created_at === "string" ? row.created_at : FALLBACK_ONBOARDING_LEARN_AUTOMATION.createdAt,
    updatedAt:
      typeof row.updated_at === "string" ? row.updated_at : FALLBACK_ONBOARDING_LEARN_AUTOMATION.updatedAt,
    isPublic: typeof row.is_public === "boolean" ? row.is_public : FALLBACK_ONBOARDING_LEARN_AUTOMATION.isPublic,
    previewCapturedAt:
      typeof row.preview_captured_at === "string" || row.preview_captured_at === null
        ? row.preview_captured_at
        : FALLBACK_ONBOARDING_LEARN_AUTOMATION.previewCapturedAt,
    clonedFrom:
      typeof row.cloned_from === "string" || row.cloned_from === null
        ? row.cloned_from
        : FALLBACK_ONBOARDING_LEARN_AUTOMATION.clonedFrom,
    previewRunId:
      typeof row.preview_run_id === "string" || row.preview_run_id === null
        ? row.preview_run_id
        : FALLBACK_ONBOARDING_LEARN_AUTOMATION.previewRunId,
  }
}
