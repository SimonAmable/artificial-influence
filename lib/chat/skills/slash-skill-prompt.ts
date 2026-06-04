import type { CommandItem } from "@/lib/commands/types"
import { isValidSkillSlug } from "@/lib/chat/skills/skill-md"

type SkillSlashEntry = {
  slug: string
  title?: string | null
  description?: string | null
  isPinned?: boolean
}

function formatSkillSlugList(slugs: string[]) {
  return slugs.map((slug) => `\`${slug}\``).join(", ")
}

export function buildActivateSkillPrompt(slugs: string[], request?: string) {
  const uniqueSlugs = [...new Set(slugs.filter((slug) => isValidSkillSlug(slug)))]
  if (uniqueSlugs.length === 0) {
    return request?.trim() ?? ""
  }

  const body = request?.trim() ?? ""

  if (uniqueSlugs.length === 1) {
    const prompt =
      `Please use the activateSkill tool with slug ${formatSkillSlugList(uniqueSlugs)} so you load that skill's instructions before continuing.`
    return body.length > 0 ? `${prompt}\n\n${body}` : prompt
  }

  const prompt =
    `Please use the activateSkill tool with these slugs in order: ${formatSkillSlugList(uniqueSlugs)} so you load those skills before continuing.`
  return body.length > 0 ? `${prompt}\n\n${body}` : prompt
}

export function normalizeLeadingSkillSlashPrompt(
  value: string,
  availableSkillSlugs: Iterable<string>,
) {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return trimmed
  }

  const knownSlugs = new Set(
    [...availableSkillSlugs].filter((slug) => isValidSkillSlug(slug)),
  )

  if (knownSlugs.size === 0) {
    return trimmed
  }

  const slugs: string[] = []
  let remainder = trimmed

  while (true) {
    const match = remainder.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)(?=\s|$)/)
    if (!match) {
      break
    }

    const slug = match[1]
    if (!knownSlugs.has(slug)) {
      break
    }

    slugs.push(slug)
    remainder = remainder.slice(match[0].length).trimStart()
  }

  if (slugs.length === 0) {
    return trimmed
  }

  return buildActivateSkillPrompt(slugs, remainder)
}

export function buildSkillSlashCommands(entries: SkillSlashEntry[]): CommandItem[] {
  return [...entries]
    .filter((entry) => isValidSkillSlug(entry.slug))
    .sort((a, b) => {
      const pinnedDelta = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned))
      if (pinnedDelta !== 0) {
        return pinnedDelta
      }

      const aLabel = (a.title?.trim() || a.slug).toLowerCase()
      const bLabel = (b.title?.trim() || b.slug).toLowerCase()
      return aLabel.localeCompare(bLabel)
    })
    .map((entry) => ({
      id: `skill-${entry.slug}`,
      label: entry.title?.trim() || entry.slug,
      description: entry.description?.trim() || `Load skill ${entry.slug}`,
      inject: `/${entry.slug} `,
    }))
}
