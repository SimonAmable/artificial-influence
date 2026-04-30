/*
 * LEGACY CUSTOM VERCEL SANDBOX LAUNCHER - NOT IN USE
 *
 * This path copied the raw remotion-renderer source tree into a sandbox,
 * installed dependencies inside the VM, and started a detached CLI job.
 *
 * The active render path now follows Remotion's recommended Vercel Sandbox
 * integration more closely from:
 * lib/video-editor/remotion-vercel-render.ts
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { Sandbox } from "@vercel/sandbox"

const SANDBOX_RENDERER_LOCAL_DIR = path.join(process.cwd(), "remotion-renderer")
const SANDBOX_RENDERER_REMOTE_DIR = "/vercel/sandbox/remotion-renderer"

type LaunchSandboxRenderParams = {
  renderJobId: string
}

type RendererFile = {
  path: string
  content: Uint8Array
}

export type SandboxRenderLaunchResult = {
  sandboxId: string
  commandId: string
  snapshotId: string | null
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for Vercel Sandbox rendering`)
  }
  return value
}

function getSandboxTimeoutMs(): number {
  const raw = process.env.VERCEL_SANDBOX_RENDER_TIMEOUT_MS
  if (!raw) {
    return 45 * 60 * 1000
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 45 * 60 * 1000
  }

  return parsed
}

function getSandboxVcpus(): number {
  const raw = process.env.VERCEL_SANDBOX_RENDER_VCPUS
  if (!raw) {
    return 4
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 4
  }

  return parsed
}

async function collectRendererFiles(): Promise<RendererFile[]> {
  const relativeFiles = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    ...(
      await collectRelativeFiles(path.join(SANDBOX_RENDERER_LOCAL_DIR, "src"), "src")
    ),
  ]

  const files = await Promise.all(
    relativeFiles.map(async (relativePath) => {
      const absolutePath = path.join(SANDBOX_RENDERER_LOCAL_DIR, relativePath)
      return {
        path: `${SANDBOX_RENDERER_REMOTE_DIR}/${relativePath.replace(/\\/g, "/")}`,
        content: await fs.readFile(absolutePath),
      }
    })
  )

  return files
}

async function collectRelativeFiles(
  absoluteDir: string,
  relativeDir: string
): Promise<string[]> {
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name)
    const relativePath = path.join(relativeDir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectRelativeFiles(absolutePath, relativePath)))
      continue
    }

    files.push(relativePath)
  }

  return files
}

function buildRenderCommand(renderJobId: string, useSnapshot: boolean): string {
  const setup = useSnapshot ? "" : "npm ci && "
  return [
    "set -euo pipefail",
    `cd ${SANDBOX_RENDERER_REMOTE_DIR}`,
    `${setup}npm run render:job -- ${renderJobId}`,
  ].join("; ")
}

export async function launchSandboxRender({
  renderJobId,
}: LaunchSandboxRenderParams): Promise<SandboxRenderLaunchResult> {
  const snapshotId = process.env.VERCEL_SANDBOX_RENDER_SNAPSHOT_ID ?? null

  const sandbox = await Sandbox.create(
    snapshotId
      ? {
          source: {
            type: "snapshot",
            snapshotId,
          },
          timeout: getSandboxTimeoutMs(),
          resources: { vcpus: getSandboxVcpus() },
          env: {
            SUPABASE_URL: getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
            SUPABASE_SERVICE_ROLE_KEY: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
          },
        }
      : {
          runtime: "node24",
          timeout: getSandboxTimeoutMs(),
          resources: { vcpus: getSandboxVcpus() },
          env: {
            SUPABASE_URL: getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
            SUPABASE_SERVICE_ROLE_KEY: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
          },
        }
  )

  if (!snapshotId) {
    await sandbox.mkDir(SANDBOX_RENDERER_REMOTE_DIR)
    await sandbox.writeFiles(await collectRendererFiles())
  }

  const command = await sandbox.runCommand({
    cmd: "bash",
    args: ["-lc", buildRenderCommand(renderJobId, Boolean(snapshotId))],
    detached: true,
  })

  return {
    sandboxId: sandbox.sandboxId,
    commandId: command.cmdId,
    snapshotId,
  }
}
