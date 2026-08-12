import { readFileSync } from "node:fs"
import { resolve } from "node:path"

function loadEnv(path) {
  try {
    const raw = readFileSync(path, "utf8")
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const index = trimmed.indexOf("=")
      if (index === -1) continue
      const key = trimmed.slice(0, index).trim()
      let value = trimmed.slice(index + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch {
    // optional env file
  }
}

loadEnv(resolve(".env.local"))
loadEnv(resolve(".env"))

const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
const webhookUrl =
  process.argv[2]?.trim() || "https://unican.ai/api/telegram/webhook"

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN in .env.local")
  process.exit(1)
}

if (!secret) {
  console.error("Missing TELEGRAM_WEBHOOK_SECRET in .env.local")
  process.exit(1)
}

const body = new URLSearchParams({
  url: webhookUrl,
  secret_token: secret,
})

const setResponse = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  body,
})

const setResult = await setResponse.json()
console.log(
  JSON.stringify(
    {
      ok: setResult.ok,
      description: setResult.description,
      url: webhookUrl,
    },
    null,
    2,
  ),
)

if (!setResult.ok) {
  process.exit(1)
}

const infoResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
const infoResult = await infoResponse.json()
console.log(JSON.stringify({ webhook_info: infoResult.result }, null, 2))
