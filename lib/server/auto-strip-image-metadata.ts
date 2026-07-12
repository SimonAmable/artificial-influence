import type { SupabaseClient } from "@supabase/supabase-js"

export async function getAutoStripImageMetadata(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("auto_strip_image_metadata")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("[auto-strip-image-metadata] Failed to load preference", {
      userId,
      error: error.message,
    })
    return false
  }

  return data?.auto_strip_image_metadata === true
}
