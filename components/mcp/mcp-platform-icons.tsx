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
  const Icon = getPlatformLobeIcon(platform)
  const ColorIcon = Icon.Color ?? Icon
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
  const Icon = getPlatformLobeIcon(platform)
  const Avatar = Icon.Avatar ?? Icon.Color ?? Icon
  return <Avatar size={size} shape="square" className={className} style={style} />
}

/** Same platforms as the connector tabs, fanned around the brand mark */
export const FAN_SIDE_ICONS: Array<{ id: McpConnectPlatform }> = MCP_PLATFORMS.map(
  (platform) => ({ id: platform.id }),
)
