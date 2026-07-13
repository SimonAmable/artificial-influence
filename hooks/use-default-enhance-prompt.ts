"use client"

import * as React from "react"

import { createClient } from "@/lib/supabase/client"

/**
 * Loads the account default for Enhance Prompt (profiles.default_enhance_prompt).
 * Use to seed local toggle state once; do not overwrite intentional overrides
 * (handoffs, examples, user toggles).
 */
export function useDefaultEnhancePrompt() {
  const [defaultEnhancePrompt, setDefaultEnhancePrompt] = React.useState(false)
  const [isReady, setIsReady] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          if (!cancelled) setIsReady(true)
          return
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("default_enhance_prompt")
          .eq("id", user.id)
          .maybeSingle()

        if (error) {
          console.error("[useDefaultEnhancePrompt]", error.message)
        }

        if (!cancelled) {
          setDefaultEnhancePrompt(data?.default_enhance_prompt === true)
          setIsReady(true)
        }
      } catch (err) {
        console.error("[useDefaultEnhancePrompt]", err)
        if (!cancelled) setIsReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { defaultEnhancePrompt, isReady }
}
