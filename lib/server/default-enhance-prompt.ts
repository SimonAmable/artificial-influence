import type { SupabaseClient } from "@supabase/supabase-js"

export async function getDefaultEnhancePrompt(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("default_enhance_prompt")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("[default-enhance-prompt] Failed to load preference", {
      userId,
      error: error.message,
    })
    return false
  }

  return data?.default_enhance_prompt === true
}
