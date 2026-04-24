import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { fetchSkillRowBySlug } from "@/lib/chat/skills/resolve-skill-row"
import {
  buildSkillDocument,
  isValidSkillSlug,
  MAX_SKILL_BODY_CHARS,
  MAX_SKILL_DESCRIPTION_LENGTH,
  parseSkillDocument,
} from "@/lib/chat/skills/skill-md"

interface CreateActivateSkillToolOptions {
  supabase: SupabaseClient
  userId: string
  skillSlugs: [string, ...string[]]
}

export function createActivateSkillTool({
  supabase,
  userId,
  skillSlugs,
}: CreateActivateSkillToolOptions) {
  const slugSchema = z.enum(skillSlugs)

  return tool({
    description:
      "Load the full instructions for an Agent Skill by slug. Call this when the user's task matches a skill from the catalog in your instructions. Returns the markdown body (frontmatter stripped) plus metadata.",
    inputSchema: z.object({
      slug: slugSchema.describe("Skill slug from the available-skills catalog."),
    }),
    strict: true,
    execute: async ({ slug }) => {
      const row = await fetchSkillRowBySlug(supabase, userId, slug)

      if (!row) {
        return {
          status: "not-found" as const,
          message: `No skill found for slug "${slug}".`,
        }
      }

      try {
        const parsed = parseSkillDocument(row.skill_document)
        return {
          status: "ok" as const,
          isMine: row.user_id === userId,
          slug: row.slug,
          title: row.title,
          name: parsed.name,
          instructions: parsed.body,
        }
      } catch {
        return {
          status: "parse-error" as const,
          message: `Skill "${slug}" could not be parsed.`,
        }
      }
    },
  })
}

interface CreateSaveSkillToolOptions {
  supabase: SupabaseClient
  userId: string
}

const slugField = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidSkillSlug, "Slug must be lowercase letters, numbers, and single hyphens (Agent Skills format).")

export function createSaveSkillTool({ supabase, userId }: CreateSaveSkillToolOptions) {
  return tool({
    description:
      "Create or update an Agent Skill (SKILL.md). Provide slug, a short description for the catalog (when to use this skill), and the markdown instruction body. Frontmatter is generated for you with name matching slug. Use for saving reusable workflows and domain rules.",
    inputSchema: z.object({
      slug: slugField,
      description: z
        .string()
        .min(1)
        .max(MAX_SKILL_DESCRIPTION_LENGTH)
        .describe("Shown in the skill catalog; say what the skill does and when to use it."),
      instructionsBody: z
        .string()
        .min(1)
        .max(MAX_SKILL_BODY_CHARS)
        .describe("Markdown instructions for the skill (body only; no YAML frontmatter)."),
      title: z
        .string()
        .min(1)
        .max(200)
        .optional()
        .describe("Optional human-readable title for the UniCan UI."),
    }),
    strict: true,
    execute: async ({ slug, description, instructionsBody, title }) => {
      const skillDocument = buildSkillDocument(slug, description, instructionsBody)

      if (skillDocument.length > MAX_SKILL_BODY_CHARS + 2048) {
        return {
          status: "error" as const,
          message: "Skill document is too large.",
        }
      }

      const { error } = await supabase.from("skills").upsert(
        {
          user_id: userId,
          slug,
          title: title ?? null,
          skill_document: skillDocument,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,slug" },
      )

      if (error) {
        console.error("[skills] saveSkill:", error.message)
        return {
          status: "error" as const,
          message: error.message,
        }
      }

      return {
        status: "saved" as const,
        slug,
        message: `Skill "${slug}" saved. It will appear in the skills catalog on the next message.`,
      }
    },
  })
}
