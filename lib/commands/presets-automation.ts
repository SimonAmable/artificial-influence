import type { CommandItem } from "./types"

/** Slash palette for scheduled automations, inject default prompt templates without chat-specific shortcuts. */
export const AUTOMATION_SLASH_COMMANDS: CommandItem[] = [
  {
    id: "auto-daily-social",
    label: "Daily social batch",
    description: "Outline a repeatable daily social content run",
    inject: `Each run: propose 3 on-brand post ideas for the week ahead, one image concept each, and a one-line caption per idea. Use attached references and brand context. Output a compact checklist the agent can execute.`,
  },
  {
    id: "auto-weekly-review",
    label: "Weekly creative review",
    description: "Summarize progress and suggest next experiments",
    inject: `Review recent thread outputs (if any), list what worked, what to try next, and 2 concrete experiments. Keep it short and actionable.`,
  },
  {
    id: "auto-asset-variants",
    label: "Generate variants",
    description: "Create variations from attached references",
    inject: `Using the attached images/videos as references, generate a small set of coherent variants (same subject, different lighting or crop). Explain choices briefly.`,
  },
  {
    id: "auto-brand-on-rails",
    label: "On-brand generation",
    description: "Steer output with @ brand context",
    inject: `Use the selected brand kit (@) for voice, colors, and typography. Produce one main deliverable aligned with brand rules and note any assumptions.`,
  },
  {
    id: "auto-pipeline-check",
    label: "Pipeline health check",
    description: "Validate uploads and listThreadMedia readiness",
    inject: `Confirm thread media is listable, summarize available reference ids from uploads, and state whether the next generation step can proceed without user input.`,
  },
]
