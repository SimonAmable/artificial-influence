import type { CommandItem } from "./types"

/** Slash palette for /chat: commands express agent intent instead of tool-specific prompt presets. */
export const CHAT_AGENT_COMMANDS: CommandItem[] = [
  {
    id: "agent-generate-image",
    label: "Generate image",
    description: "Ask the agent to create an image now",
    inject: "Generate an image from this: ",
  },
  {
    id: "agent-edit-image",
    label: "Edit attached image",
    description: "Use the current image reference as the visual target",
    inject: "Edit the attached image so that: ",
  },
  {
    id: "agent-analyze-references",
    label: "Analyze references",
    description: "Review attached assets and call out what matters",
    inject: "Analyze the attached references and tell me: ",
  },
  {
    id: "agent-creative-brief",
    label: "Creative brief",
    description: "Turn a rough idea into a concise brief",
    inject: "Turn this into a concise creative brief: ",
  },
  {
    id: "agent-polish-prompt",
    label: "Polish prompt",
    description: "Rewrite the idea as a stronger generation prompt",
    inject: "Rewrite this as a stronger generation prompt: ",
  },
  {
    id: "agent-recommend-workflow",
    label: "Recommend workflow",
    description: "Choose the best Uni workflow for the goal",
    inject: "Recommend the best workflow for this goal: ",
  },
  {
    id: "agent-use-brand",
    label: "Use brand",
    description: "Steer the agent toward selected brand context",
    inject: "Use the selected brand context for this: ",
  },
]
