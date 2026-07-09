import { spawn } from "node:child_process"

const usePortless = process.argv.includes("--portless")

const env = {
  ...process.env,
  NEXT_PUBLIC_PRODUCT_ID: "presence-studio",
  PRODUCT_ID: "presence-studio",
  PRESENCE_LOCAL_DEV: "1",
}

const command = usePortless ? "npx" : "next"
const args = usePortless ? ["portless", "presence", "next", "dev"] : ["dev"]

const child = spawn(command, args, {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

