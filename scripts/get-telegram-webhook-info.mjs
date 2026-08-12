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
if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN")
  process.exit(1)
}

const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
const data = await response.json()
console.log(JSON.stringify(data.result, null, 2))
