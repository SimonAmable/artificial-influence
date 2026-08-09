#!/usr/bin/env node
/**
 * Bans abuser auth accounts (profiles remediation runs via SQL migration).
 *
 * Requires:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/apply-credit-security-lockdown.mjs
 */

import { createClient } from "@supabase/supabase-js"

const BANNED_USER_IDS = [
  "ed800471-24e9-43cf-9d96-25f47fd90725",
  "d9e9ebbf-7af0-44d2-b21d-01e9fd7e919a",
  "fb24dcb4-0afa-4de0-957d-63405d5244a6",
  "757138b6-eef4-4f0e-bbec-ba3e03c48767",
  "03c2cf2f-247c-4484-9dff-d41b182f46a0",
  "73203ddc-cd54-412a-b661-8a5e26fa2a92",
  "9e3a45bd-0152-4856-bda5-ebd1ccbed069",
]

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function banAuthUsers() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  for (const userId of BANNED_USER_IDS) {
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    })
    if (error) {
      throw new Error(`Failed to ban auth user ${userId}: ${error.message}`)
    }
    console.log(`Banned auth user ${userId} (${data.user?.email ?? "unknown email"})`)
  }
}

async function main() {
  await banAuthUsers()
  console.log("Abuser auth bans complete.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
