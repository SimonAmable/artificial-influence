import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { listOwnedAutomations } from "@/lib/automations/service"

interface CreateListAutomationsToolOptions {
  supabase: SupabaseClient
  userId: string
}

export function createListAutomationsTool({
  supabase,
  userId,
}: CreateListAutomationsToolOptions) {
  return tool({
    description:
      "List the user's automations with ids, schedules, state, and latest run status. Use this before editing, pausing, resuming, deleting, or running an automation so you do not guess the target.",
    inputSchema: z.object({}),
    strict: true,
    execute: async () => {
      const automations = await listOwnedAutomations(supabase, userId)

      return {
        automations: automations.map((automation) => ({
          id: automation.id,
          name: automation.name,
          description: automation.description,
          scheduleSummary: automation.scheduleSummary,
          timezone: automation.timezone,
          model: automation.model,
          isActive: automation.is_active,
          nextRunAt: automation.next_run_at,
          lastRunAt: automation.last_run_at,
          runCount: automation.run_count,
          lastError: automation.last_error,
          latestRun: automation.latestRun,
        })),
        message:
          automations.length > 0
            ? `Found ${automations.length} automation${automations.length === 1 ? "" : "s"}.`
            : "No automations were found.",
        total: automations.length,
      }
    },
  })
}
