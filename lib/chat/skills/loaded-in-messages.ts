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
      const toolPart = part as {
        output?: { slug?: string; status?: string }
        state?: string
        type?: string
      }
      if (
        toolPart.type === "tool-activateSkill" &&
        toolPart.state === "output-available" &&
        toolPart.output?.status === "ok" &&
        typeof toolPart.output.slug === "string" &&
        toolPart.output.slug.length > 0
      ) {
        slugs.add(toolPart.output.slug)
      }
    }
  }

  return [...slugs]
}

export function countUniqueSkillsLoadedInMessages(messages: UIMessage[]): number {
  return getLoadedSkillSlugsFromMessages(messages).length
}
