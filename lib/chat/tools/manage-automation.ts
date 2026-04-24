import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import type {
  AutomationPromptAttachment,
  AutomationPromptPayload,
} from "@/lib/automations/prompt-payload"
import {
  createAutomationForUser,
  deleteAutomationForUser,
  getOwnedAutomationForUser,
  mergeAutomationPromptPayload,
  resolveAutomationSchedule,
  runAutomationNowForUser,
  setAutomationActiveForUser,
  updateAutomationForUser,
} from "@/lib/automations/service"
import type { AttachedRef } from "@/lib/commands/types"

interface CreateManageAutomationToolOptions {
  defaultAttachments?: AutomationPromptAttachment[]
  defaultRefs?: AttachedRef[]
  supabase: SupabaseClient
  userId: string
}

const refSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: z.enum(["brand", "asset"]),
  assetType: z.enum(["image", "video", "audio"]).optional(),
  assetUrl: z.string().url().optional(),
  previewUrl: z.string().url().nullable().optional(),
  serialized: z.string().min(1),
  chipId: z.string().min(1),
  mentionToken: z.string().min(1),
})

const attachmentSchema = z.object({
  url: z.string().url(),
  mediaType: z.string().min(1),
  filename: z.string().min(1).optional(),
})

function ensureAutomationId(action: string, automationId?: string) {
  if (!automationId) {
    throw new Error(`automationId is required for ${action}.`)
  }
  return automationId
}

function resolvePayloadDefaults(input: {
  attachments?: AutomationPromptAttachment[]
  defaultAttachments: AutomationPromptAttachment[]
  defaultRefs: AttachedRef[]
  fallback?: AutomationPromptPayload | null
  promptText?: string
  refs?: AttachedRef[]
}) {
  const refs =
    input.refs !== undefined
      ? input.refs
      : input.defaultRefs.length > 0
        ? input.defaultRefs
        : undefined
  const attachments =
    input.attachments !== undefined
      ? input.attachments
      : input.defaultAttachments.length > 0
        ? input.defaultAttachments
        : undefined

  return mergeAutomationPromptPayload({
    promptText: input.promptText,
    refs,
    attachments,
    fallback: input.fallback,
  })
}

export function createManageAutomationTool({
  defaultAttachments = [],
  defaultRefs = [],
  supabase,
  userId,
}: CreateManageAutomationToolOptions) {
  return tool({
    description:
      "Create or manage a UniCan automation. Supported actions: create, update, pause, resume, run_now, and delete. Always use listAutomations first before targeting an existing automation.",
    inputSchema: z.object({
      action: z.enum(["create", "update", "pause", "resume", "run_now", "delete"]),
      automationId: z.string().uuid().optional(),
      name: z.string().max(120).optional(),
      description: z.string().max(500).optional(),
      promptText: z.string().max(12000).optional(),
      cronScheduleOrNaturalLanguage: z.string().max(200).optional(),
      timezone: z.string().max(100).optional(),
      model: z.string().max(200).optional(),
      isActive: z.boolean().optional(),
      refs: z.array(refSchema).optional(),
      attachments: z.array(attachmentSchema).optional(),
    }),
    strict: true,
    needsApproval: true,
    execute: async (input) => {
      if (input.action === "create") {
        if (!input.name?.trim()) {
          throw new Error("name is required for create.")
        }
        if (!input.promptText?.trim()) {
          throw new Error("promptText is required for create.")
        }
        if (!input.cronScheduleOrNaturalLanguage?.trim()) {
          throw new Error("cronScheduleOrNaturalLanguage is required for create.")
        }

        const promptPayload = resolvePayloadDefaults({
          promptText: input.promptText,
          refs: input.refs,
          attachments: input.attachments,
          defaultRefs,
          defaultAttachments,
        })
        const automation = await createAutomationForUser(supabase, userId, {
          name: input.name,
          description: input.description,
          promptPayload,
          cronScheduleOrNaturalLanguage: input.cronScheduleOrNaturalLanguage,
          timezone: input.timezone,
          model: input.model,
          isActive: input.isActive,
        })
        const schedule = resolveAutomationSchedule({
          cronScheduleOrNaturalLanguage: automation.cron_schedule,
          timezone: automation.timezone,
        })

        return {
          action: "create" as const,
          automation: {
            id: automation.id,
            name: automation.name,
            description: automation.description ?? null,
            promptExcerpt: automation.prompt,
            scheduleSummary: schedule.summary,
            cronSchedule: automation.cron_schedule,
            timezone: automation.timezone,
            model: automation.model ?? null,
            isActive: automation.is_active,
            nextRunAt: automation.next_run_at,
          },
          message: "Automation created.",
        }
      }

      if (input.action === "update") {
        const automationId = ensureAutomationId(input.action, input.automationId)
        const existing = await getOwnedAutomationForUser(supabase, userId, automationId)
        const nextPayload =
          input.promptText !== undefined ||
          input.refs !== undefined ||
          input.attachments !== undefined ||
          defaultRefs.length > 0 ||
          defaultAttachments.length > 0
            ? resolvePayloadDefaults({
                promptText: input.promptText,
                refs: input.refs,
                attachments: input.attachments,
                defaultRefs,
                defaultAttachments,
                fallback: existing.prompt_payload ?? null,
              })
            : undefined

        const automation = await updateAutomationForUser(supabase, userId, automationId, {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(nextPayload ? { promptPayload: nextPayload } : {}),
          ...(input.cronScheduleOrNaturalLanguage !== undefined
            ? { cronScheduleOrNaturalLanguage: input.cronScheduleOrNaturalLanguage }
            : {}),
          ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
          ...(input.model !== undefined ? { model: input.model } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        })
        const schedule = resolveAutomationSchedule({
          cronScheduleOrNaturalLanguage: automation.cron_schedule,
          timezone: automation.timezone,
        })

        return {
          action: "update" as const,
          automation: {
            id: automation.id,
            name: automation.name,
            description: automation.description ?? null,
            promptExcerpt: automation.prompt,
            scheduleSummary: schedule.summary,
            cronSchedule: automation.cron_schedule,
            timezone: automation.timezone,
            model: automation.model ?? null,
            isActive: automation.is_active,
            nextRunAt: automation.next_run_at,
          },
          message: "Automation updated.",
        }
      }

      if (input.action === "pause" || input.action === "resume") {
        const automationId = ensureAutomationId(input.action, input.automationId)
        const automation = await setAutomationActiveForUser(
          supabase,
          userId,
          automationId,
          input.action === "resume",
        )
        const schedule = resolveAutomationSchedule({
          cronScheduleOrNaturalLanguage: automation.cron_schedule,
          timezone: automation.timezone,
        })

        return {
          action: input.action,
          automation: {
            id: automation.id,
            name: automation.name,
            description: automation.description ?? null,
            promptExcerpt: automation.prompt,
            scheduleSummary: schedule.summary,
            cronSchedule: automation.cron_schedule,
            timezone: automation.timezone,
            model: automation.model ?? null,
            isActive: automation.is_active,
            nextRunAt: automation.next_run_at,
          },
          message: input.action === "pause" ? "Automation paused." : "Automation resumed.",
        }
      }

      if (input.action === "run_now") {
        const automationId = ensureAutomationId(input.action, input.automationId)
        const existing = await getOwnedAutomationForUser(supabase, userId, automationId)
        const result = await runAutomationNowForUser(supabase, userId, automationId)
        const schedule = resolveAutomationSchedule({
          cronScheduleOrNaturalLanguage: existing.cron_schedule,
          timezone: existing.timezone,
        })

        return {
          action: "run_now" as const,
          automation: {
            id: existing.id,
            name: existing.name,
            description: existing.description ?? null,
            promptExcerpt: existing.prompt,
            scheduleSummary: schedule.summary,
            cronSchedule: existing.cron_schedule,
            timezone: existing.timezone,
            model: existing.model ?? null,
            isActive: existing.is_active,
            nextRunAt: existing.next_run_at,
          },
          message: "Automation run started.",
          runId: result.runId,
          threadId: result.threadId,
        }
      }

      const automationId = ensureAutomationId(input.action, input.automationId)
      const existing = await getOwnedAutomationForUser(supabase, userId, automationId)
      await deleteAutomationForUser(supabase, userId, automationId)

      return {
        action: "delete" as const,
        deletedAutomationId: existing.id,
        deletedAutomationName: existing.name,
        message: "Automation deleted.",
      }
    },
  })
}
