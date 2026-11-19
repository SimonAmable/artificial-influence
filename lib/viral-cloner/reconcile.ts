import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
export async function reconcileViralCloneItemFromGeneration(input: {
  supabase: SupabaseClient
  generationId: string
  status: "completed" | "failed"
  outputUrl?: string | null
  errorMessage?: string | null
}): Promise<void> {
  const { data: generation } = await input.supabase
    .from("generations")
    .select("id, status, metadata, tool")
    .eq("id", input.generationId)
    .maybeSingle()

  if (!generation || generation.tool !== "viral_cloner") return

  const metadata = generation.metadata as { viralClone?: { jobId?: string; itemIndex?: number } } | null
  const jobId = metadata?.viralClone?.jobId
  const itemIndex = metadata?.viralClone?.itemIndex
  if (!jobId || typeof itemIndex !== "number") return

  const { data: item } = await input.supabase
    .from("viral_clone_items")
    .select("id, reservation_key, status")
    .eq("job_id", jobId)
    .eq("item_index", itemIndex)
    .maybeSingle()

  if (!item) return

  const terminal = item.status === "completed" || item.status === "failed"
  if (terminal) return

  if (input.status === "completed") {
    await input.supabase
      .from("viral_clone_items")
      .update({
        status: "completed",
        output_url: input.outputUrl ?? null,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", item.id)

  } else {
    await input.supabase
      .from("viral_clone_items")
      .update({
        status: "failed",
        error_message: input.errorMessage ?? "Generation failed.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", item.id)
  }

  const { data: siblings } = await input.supabase
    .from("viral_clone_items")
    .select("status")
    .eq("job_id", jobId)

  const rows = siblings ?? []
  if (rows.length === 0) return

  const allDone = rows.every((row) => row.status === "completed" || row.status === "failed")
  if (!allDone) {
    await input.supabase.from("viral_clone_jobs").update({ status: "processing" }).eq("id", jobId)
    return
  }

  const anySuccess = rows.some((row) => row.status === "completed")
  const allSuccess = rows.every((row) => row.status === "completed")
  const nextStatus = allSuccess ? "completed" : anySuccess ? "partial" : "failed"

  await input.supabase
    .from("viral_clone_jobs")
    .update({
      status: nextStatus,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId)
}