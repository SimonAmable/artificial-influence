export type McpConnectMode = "mcp" | "cli"

export type McpConnectPlatform =
  | "claude"
  | "chatgpt"
  | "cursor"
  | "claude-code"
  | "codex"
  | "openclaw"
  | "hermes"

export type McpConnectStep = {
  title: string
  description: string
  copyValue?: string
  copyMultiline?: boolean
  actionLabel?: string
  actionHref?: string
  actionExternal?: boolean
  /** Solid accent CTA (e.g. "Start creating") */
  actionAccent?: boolean
  showBrandInTitle?: boolean
}

export type McpPlatformConfig = {
  id: McpConnectPlatform
  label: string
  /** MCP supported today; CLI tab is shown but not enabled yet */
  mcpSupported: boolean
  customizeUrl?: string
  agentPrompt?: boolean
}

export const MCP_PLATFORMS: McpPlatformConfig[] = [
  {
    id: "claude",
    label: "Claude",
    mcpSupported: true,
    customizeUrl: "https://claude.ai/settings/connectors",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    mcpSupported: true,
    customizeUrl: "https://chatgpt.com/",
  },
  {
    id: "cursor",
    label: "Cursor",
    mcpSupported: true,
  },
  {
    id: "claude-code",
    label: "Claude Code",
    mcpSupported: true,
    agentPrompt: true,
  },
  {
    id: "codex",
    label: "Codex",
    mcpSupported: true,
    agentPrompt: true,
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    mcpSupported: true,
    agentPrompt: true,
  },
  {
    id: "hermes",
    label: "Hermes",
    mcpSupported: true,
    agentPrompt: true,
  },
]

export const MCP_TOOLS_PREVIEW = [
  "get_account",
  "list_models",
  "list_generations",
  "search_generations",
  "search_media",
  "list_characters",
  "get_generation",
  "generate_image",
  "generate_video",
  "generate_audio",
] as const

export function getMcpServerSlug(productName: string) {
  return productName.toLowerCase().replace(/\s+/g, "-")
}

export function buildMcpEndpointUrl(mcpBaseUrl: string) {
  return `${mcpBaseUrl.replace(/\/$/, "")}/mcp`
}

function buildAgentSetupPrompt(productName: string, endpoint: string) {
  return [
    `Set up ${productName} for me so I can generate images and videos from here.`,
    ``,
    `1. Add the ${productName} MCP server: ${endpoint} (Streamable HTTP).`,
    `2. Authenticate: complete the sign-in in the browser it opens.`,
    ``,
    `Once that's done, let me know when it's ready.`,
  ].join("\n")
}

export function getMcpConnectSteps(options: {
  mode: McpConnectMode
  platform: McpConnectPlatform
  productName: string
  mcpBaseUrl: string
}): McpConnectStep[] {
  const { mode, platform, productName, mcpBaseUrl } = options
  const endpoint = buildMcpEndpointUrl(mcpBaseUrl)
  const slug = getMcpServerSlug(productName)
  const platformConfig = MCP_PLATFORMS.find((item) => item.id === platform)

  // CLI is listed in the UI but not supported yet
  if (mode === "cli") {
    return [
      {
        title: "CLI coming soon",
        description: `We're finishing the ${productName} CLI installer. Use MCP for now — it works with the same account and tools.`,
        actionLabel: "Use MCP setup",
        actionHref: "#mcp-setup",
      },
    ]
  }

  if (platformConfig?.agentPrompt) {
    const agentLabel = platformConfig.label
    return [
      {
        title: `Copy and send this to ${agentLabel}`,
        description: `Paste into ${agentLabel} and let it wire up the MCP server for you.`,
        copyValue: buildAgentSetupPrompt(productName, endpoint),
        copyMultiline: true,
      },
      {
        title: "Connect and start creating",
        description: `Sign in, then ask ${agentLabel} to generate an image or video.`,
        actionLabel: "Start creating",
        actionHref: "/login?mode=signup&next=/mcp",
        actionAccent: true,
      },
    ]
  }

  switch (platform) {
    case "claude":
      return [
        {
          title: `Copy the ${productName} connector URL`,
          description: "You'll paste this URL into Claude in the next step",
          copyValue: endpoint,
          showBrandInTitle: true,
        },
        {
          title: "Go to Claude → Customize",
          description: `In Claude desktop or claude.ai, go to Customize → Connectors. Name it ${productName} and paste the URL.`,
          actionLabel: "Open Claude Customize",
          actionHref: platformConfig?.customizeUrl ?? "https://claude.ai/settings/connectors",
          actionExternal: true,
        },
        {
          title: "Connect, sign in and start",
          description: "Sign in, then ask Claude to generate an image or video",
          actionLabel: "Start creating",
          actionHref: "/login?mode=signup&next=/mcp",
          actionAccent: true,
        },
      ]
    case "chatgpt":
      return [
        {
          title: `Copy the ${productName} connector URL`,
          description: "You'll paste this URL into ChatGPT in the next step",
          copyValue: endpoint,
          showBrandInTitle: true,
        },
        {
          title: "Open ChatGPT → Settings",
          description: `Go to Settings → Connectors (or Apps) and add a custom MCP connector named ${productName}.`,
          actionLabel: "Open ChatGPT",
          actionHref: platformConfig?.customizeUrl ?? "https://chatgpt.com/",
          actionExternal: true,
        },
        {
          title: "Connect, sign in and start",
          description: "Authorize your account, then ask ChatGPT to generate an image or video",
          actionLabel: "Start creating",
          actionHref: "/login?mode=signup&next=/mcp",
          actionAccent: true,
        },
      ]
    case "cursor":
      return [
        {
          title: `Copy the ${productName} connector URL`,
          description: "You'll paste this URL into Cursor MCP settings next",
          copyValue: endpoint,
          showBrandInTitle: true,
        },
        {
          title: "Open Cursor → MCP",
          description: `In Cursor, go to Settings → MCP → Add server. Name it ${slug} and paste the URL (Streamable HTTP).`,
          actionLabel: `${productName} login`,
          actionHref: "/login?next=/mcp",
        },
        {
          title: "Connect, sign in and start",
          description: "Approve OAuth, then ask Cursor to generate an image or video",
          actionLabel: "Start creating",
          actionHref: "/login?mode=signup&next=/mcp",
          actionAccent: true,
        },
      ]
    case "claude-code":
    case "codex":
    case "openclaw":
    case "hermes":
      // Handled above via agentPrompt
      return []
    default: {
      const _exhaustive: never = platform
      return _exhaustive
    }
  }
}

export function getDefaultPlatformForMode(_mode: McpConnectMode): McpConnectPlatform {
  return "claude"
}

export function getPlatformsForMode(mode: McpConnectMode) {
  if (mode === "cli") return MCP_PLATFORMS
  return MCP_PLATFORMS.filter((platform) => platform.mcpSupported)
}
