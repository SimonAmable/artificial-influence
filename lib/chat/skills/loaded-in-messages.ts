import type { UIMessage } from "ai"

/**
 * Unique skill slugs successfully activated in this conversation (assistant tool parts).
 */
export function getLoadedSkillSlugsFromMessages(messages: UIMessage[]): string[] {
  const slugs = new Set<string>()

  for (const message of messages) {
    if (message.role !== "assistant" || !message.parts) {
      continue
    }

    for (const part of message.parts) {
      if (
        part.type === "tool-activateSkill" &&
        part.state === "output-available" &&
        part.output?.status === "ok" &&
        typeof part.output.slug === "string" &&
        part.output.slug.length > 0
      ) {
        slugs.add(part.output.slug)
      }
    }
  }

  return [...slugs]
}

export function countUniqueSkillsLoadedInMessages(messages: UIMessage[]): number {
  return getLoadedSkillSlugsFromMessages(messages).length
}
