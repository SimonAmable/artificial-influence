import fs from "node:fs"
import path from "node:path"

const root = path.join(import.meta.dirname, "..")
const needle = "scriptProps:w})=>{let p=JSON.stringify"
const replacement =
  'scriptProps:w})=>{if(typeof window!=="undefined")return null;let p=JSON.stringify'

for (const rel of ["node_modules/next-themes/dist/index.mjs", "node_modules/next-themes/dist/index.js"]) {
  const file = path.join(root, rel)
  const source = fs.readFileSync(file, "utf8")
  if (!source.includes(needle)) {
    console.error(`patch-next-themes: pattern not found in ${rel}`)
    process.exit(1)
  }
  fs.writeFileSync(file, source.replace(needle, replacement))
  console.log(`patch-next-themes: updated ${rel}`)
}
