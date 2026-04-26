export const ALWAYS_AVAILABLE_CREATIVE_CHAT_TOOL_KEYS = [
  "listAutomations",
  "listInstagramConnections",
  "manageAutomation",
  "prepareInstagramPost",
  "generateAudio",
  "generateImage",
  "generateVideo",
  "extractVideoFrames",
  "getBrandContext",
  "listRecentGenerations",
  "saveGenerationAsAsset",
  "searchWeb",
  "readWebPage",
  "searchWebImages",
  "capturePageScreenshot",
  "searchAssets",
  "searchModels",
  "searchVoices",
  "awaitGeneration",
  "estimateModelLatency",
  "saveSkill",
] as const

export const THREAD_ONLY_CREATIVE_CHAT_TOOL_KEYS = [
  "listThreadMedia",
  "composeTimelineVideo",
  "scheduleGenerationFollowUp",
] as const

export const SKILL_OPTIONAL_CREATIVE_CHAT_TOOL_KEYS = ["activateSkill"] as const

export function getExpectedCreativeChatToolKeys(options?: {
  includeThreadTools?: boolean
  includeActivateSkill?: boolean
}) {
  const keys: string[] = [...ALWAYS_AVAILABLE_CREATIVE_CHAT_TOOL_KEYS]

  if (options?.includeThreadTools !== false) {
    keys.push(...THREAD_ONLY_CREATIVE_CHAT_TOOL_KEYS)
  }

  if (options?.includeActivateSkill !== false) {
    keys.push(...SKILL_OPTIONAL_CREATIVE_CHAT_TOOL_KEYS)
  }

  return keys
}
