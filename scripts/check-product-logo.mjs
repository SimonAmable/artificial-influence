import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const allowed = new Set([
  path.join("lib", "product", "products", "unican.ts"),
  path.join("public", "logo.svg"),
  path.join("scripts", "check-product-logo.mjs"),
])

const skipDirs = new Set([
  "node_modules",
  ".next",
  ".git",
  "remotion-renderer",
])

const offenders = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath)
      continue
    }

    const relative = path.relative(root, fullPath).split(path.sep).join("/")
    if (allowed.has(relative.replace(/\//g, path.sep))) continue
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|css|md)$/.test(entry.name)) continue

    const contents = fs.readFileSync(fullPath, "utf8")
    if (
      /['"`]\/logo\.svg['"`]/.test(contents) ||
      /url\(['"]?\/logo\.svg['"]?\)/.test(contents)
    ) {
      offenders.push(relative)
    }
  }
}

walk(root)

if (offenders.length > 0) {
  console.error("Hardcoded UniCan logo paths found outside product config:")
  for (const file of offenders) {
    console.error(`  - ${file}`)
  }
  process.exit(1)
}

console.log("Product logo branding check passed.")
