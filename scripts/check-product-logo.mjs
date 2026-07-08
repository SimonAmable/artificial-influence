import { execSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const output = execSync(
  'npx --yes rg "/logo\\.svg" --glob "!lib/product/products/unican.ts" --glob "!public/logo.svg"',
  { cwd: root, encoding: "utf8" },
).trim()

if (output.length > 0) {
  console.error("Hardcoded UniCan logo paths found outside product config:\n")
  console.error(output)
  process.exit(1)
}

console.log("Product logo branding check passed.")
