import type { UIMessage } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Records the first successful run's messages as the public preview snapshot.
 * Only applies when the automation is public and preview_thread is still null.
 */
export async function captureAutomationPreview(
  admin: SupabaseClient,
  automationId: string,
  runId: string,
  messages: UIMessage[],
): Promise<void> {
  const nowIso = new Date().toISOString()
  const { error } = await admin
    .from("automations")
    .update({
      preview_thread: messages as unknown as Record<string, unknown>[],
      preview_captured_at: nowIso,
      preview_run_id: runId,
      updated_at: nowIso,
    })
    .eq("id", automationId)
    .eq("is_public", true)
    .is("preview_thread", null)

  if (error) {
    console.error("[automations/preview] capture failed:", error)
  }
}

/**
 * Overwrites the public preview snapshot with a specific run's thread messages.
 * Caller must verify ownership and that the automation is public before calling.
 */
export async function setAutomationPreviewRun(
  admin: SupabaseClient,
  automationId: string,
  runId: string,
  messages: UIMessage[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nowIso = new Date().toISOString()
  const { error } = await admin
    .from("automations")
    .update({
      preview_thread: messages as unknown as Record<string, unknown>[],
      preview_captured_at: nowIso,
      preview_run_id: runId,
      updated_at: nowIso,
    })
    .eq("id", automationId)
    .eq("is_public", true)

  if (error) {
    console.error("[automations/preview] set failed:", error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
