export type McpConnectMode = "mcp" | "cli"

export type McpConnectPlatform = "claude" | "chatgpt" | "cursor" | "codex"

export type McpConnectStep = {
  title: string
  description: string
  copyValue?: string
  actionLabel?: string
  actionHref?: string
  promptExample?: string
}

export type McpPlatformConfig = {
  id: McpConnectPlatform
  label: string
  modes: McpConnectMode[]
  cliAgentLabel?: string
}

export const MCP_PLATFORMS: McpPlatformConfig[] = [
  { id: "claude", label: "Claude", modes: ["mcp", "cli"], cliAgentLabel: "Claude Code" },
  { id: "chatgpt", label: "ChatGPT", modes: ["mcp"] },
  { id: "cursor", label: "Cursor", modes: ["mcp", "cli"] },
  { id: "codex", label: "Codex", modes: ["cli"], cliAgentLabel: "Codex" },
]

export const MCP_TOOLS_PREVIEW = [
  "get_account",
  "list_models",
  "list_generations",
  "search_generations",
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

export function buildCliCommand(
  mcpBaseUrl: string,
  productName: string,
  platform: McpConnectPlatform,
) {
  const slug = getMcpServerSlug(productName)
  const endpoint = buildMcpEndpointUrl(mcpBaseUrl)

  if (platform === "cursor") {
    return JSON.stringify(
      {
        mcpServers: {
          [slug]: {
            url: endpoint,
          },
        },
      },
      null,
      2,
    )
  }

  return `claude mcp add --transport http ${slug} ${endpoint}`
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

  if (mode === "cli") {
    const cliValue = buildCliCommand(mcpBaseUrl, productName, platform)
    const agentLabel =
      MCP_PLATFORMS.find((item) => item.id === platform)?.cliAgentLabel ?? "your coding agent"

    return [
      {
        title: platform === "cursor" ? "Add to MCP config" : "Add the server",
        description:
          platform === "cursor"
            ? `Paste this into Cursor Settings → MCP, or your project's .cursor/mcp.json.`
            : `Run this in your terminal to register ${productName} MCP with ${agentLabel}.`,
        copyValue: cliValue,
      },
      {
        title: "Sign in with your account",
        description: `${agentLabel} opens a browser the first time you use a ${productName} tool. Sign in with your ${productName} account to authorize access.`,
        actionLabel: `${productName} login`,
        actionHref: "/login?next=/mcp",
      },
      {
        title: "Invoke from chat",
        description: `Once connected, ask your agent to generate content with natural language.`,
        promptExample: `Generate a product photo with ${productName}.`,
      },
    ]
  }

  const connectorSteps: Record<McpConnectPlatform, McpConnectStep[]> = {
    claude: [
      {
        title: "Copy the MCP URL",
        description: "Click copy below — you'll paste this into Claude's connector settings.",
        copyValue: endpoint,
      },
      {
        title: "Open Settings → Connectors",
        description: `Add a custom connector, name it ${productName}, and paste the URL.`,
        actionLabel: `${productName} login`,
        actionHref: "/login?next=/mcp",
      },
      {
        title: "Connect and sign in",
        description: `Click Add → Connect, sign in with your ${productName} account — then ask Claude to generate an image or video.`,
        promptExample: `Use ${productName} to create a UGC-style ad image.`,
      },
    ],
    chatgpt: [
      {
        title: "Copy the MCP URL",
        description: "Copy the endpoint below for ChatGPT's connector setup.",
        copyValue: endpoint,
      },
      {
        title: "Open ChatGPT Settings",
        description: "Go to Settings → Connectors (or Apps) and add a custom MCP connector.",
        actionLabel: `${productName} login`,
        actionHref: "/login?next=/mcp",
      },
      {
        title: "Connect and sign in",
        description: `Authorize with your ${productName} account, then prompt ChatGPT to generate content directly.`,
        promptExample: `Generate a short-form video concept with ${productName}.`,
      },
    ],
    cursor: [
      {
        title: "Copy the MCP URL",
        description: "Use this URL when adding a remote MCP server in Cursor settings.",
        copyValue: endpoint,
      },
      {
        title: "Open Cursor MCP settings",
        description: `In Cursor, go to Settings → MCP → Add server. Name it ${slug} and paste the URL.`,
        actionLabel: `${productName} login`,
        actionHref: "/login?next=/mcp",
      },
      {
        title: "Connect and sign in",
        description: `Approve the OAuth prompt with your ${productName} account — then ask the agent to generate from chat.`,
        promptExample: `List my recent ${productName} generations.`,
      },
    ],
    codex: [],
  }

  return connectorSteps[platform]
}

export function getDefaultPlatformForMode(mode: McpConnectMode): McpConnectPlatform {
  return mode === "cli" ? "claude" : "claude"
}

export function getPlatformsForMode(mode: McpConnectMode) {
  return MCP_PLATFORMS.filter((platform) => platform.modes.includes(mode))
}
