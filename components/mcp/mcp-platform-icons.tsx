"use client"

import type { ComponentType, CSSProperties } from "react"
import {
  Claude,
  ClaudeCode,
  Codex,
  Cursor,
  NousResearch,
  OpenAI,
  OpenClaw,
} from "@lobehub/icons"

import {
  MCP_PLATFORMS,
  type McpConnectPlatform,
} from "@/lib/constants/mcp-connect"

type IconProps = {
  size?: number | string
  className?: string
  style?: CSSProperties
  shape?: "circle" | "square"
}

type LobeCompoundIcon = ComponentType<IconProps> & {
  Avatar?: ComponentType<IconProps>
  Color?: ComponentType<IconProps>
}

const PLATFORM_ICONS: Record<McpConnectPlatform, LobeCompoundIcon> = {
  claude: Claude as LobeCompoundIcon,
  chatgpt: OpenAI as LobeCompoundIcon,
  cursor: Cursor as LobeCompoundIcon,
  "claude-code": ClaudeCode as LobeCompoundIcon,
  codex: Codex as LobeCompoundIcon,
  openclaw: OpenClaw as LobeCompoundIcon,
  hermes: NousResearch as LobeCompoundIcon,
}

function resolveColorIcon(Icon: LobeCompoundIcon): ComponentType<IconProps> {
  return Icon.Color ?? Icon
}

function resolveAvatarIcon(Icon: LobeCompoundIcon): ComponentType<IconProps> {
  return Icon.Avatar ?? Icon.Color ?? Icon
}

const PLATFORM_COLOR_ICONS = {
  claude: resolveColorIcon(PLATFORM_ICONS.claude),
  chatgpt: resolveColorIcon(PLATFORM_ICONS.chatgpt),
  cursor: resolveColorIcon(PLATFORM_ICONS.cursor),
  "claude-code": resolveColorIcon(PLATFORM_ICONS["claude-code"]),
  codex: resolveColorIcon(PLATFORM_ICONS.codex),
  openclaw: resolveColorIcon(PLATFORM_ICONS.openclaw),
  hermes: resolveColorIcon(PLATFORM_ICONS.hermes),
} as const satisfies Record<McpConnectPlatform, ComponentType<IconProps>>

const PLATFORM_AVATAR_ICONS = {
  claude: resolveAvatarIcon(PLATFORM_ICONS.claude),
  chatgpt: resolveAvatarIcon(PLATFORM_ICONS.chatgpt),
  cursor: resolveAvatarIcon(PLATFORM_ICONS.cursor),
  "claude-code": resolveAvatarIcon(PLATFORM_ICONS["claude-code"]),
  codex: resolveAvatarIcon(PLATFORM_ICONS.codex),
  openclaw: resolveAvatarIcon(PLATFORM_ICONS.openclaw),
  hermes: resolveAvatarIcon(PLATFORM_ICONS.hermes),
} as const satisfies Record<McpConnectPlatform, ComponentType<IconProps>>

export function getPlatformLobeIcon(platform: McpConnectPlatform): LobeCompoundIcon {
  return PLATFORM_ICONS[platform]
}

export function PlatformLobeIcon({
  platform,
  size = 16,
  className,
}: {
  platform: McpConnectPlatform
  size?: number
  className?: string
}) {
  const ColorIcon = PLATFORM_COLOR_ICONS[platform]
  return <ColorIcon size={size} className={className} />
}

export function PlatformFanAvatar({
  platform,
  size = 64,
  className,
  style,
}: {
  platform: McpConnectPlatform
  size?: number
  className?: string
  style?: CSSProperties
}) {
  const Avatar = PLATFORM_AVATAR_ICONS[platform]
  return <Avatar size={size} shape="square" className={className} style={style} />
}

/** Same platforms as the connector tabs, fanned around the brand mark */
export const FAN_SIDE_ICONS: Array<{ id: McpConnectPlatform }> = MCP_PLATFORMS.map(
  (platform) => ({ id: platform.id }),
)
