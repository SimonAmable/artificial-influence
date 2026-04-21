import "server-only"

import fs from "fs"
import path from "path"

import matter from "gray-matter"
import { notFound } from "next/navigation"

export const LEGAL_SLUGS = ["privacy", "terms", "delete-account"] as const

export type LegalSlug = (typeof LEGAL_SLUGS)[number]

export type LegalFrontmatter = {
  title: string
  description: string
  lastUpdated?: string
  version?: string
}

const LEGAL_DIR = path.join(process.cwd(), "content/legal")

function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value)
}

export function loadLegalDoc(slug: string): { data: LegalFrontmatter; content: string } {
  if (!isLegalSlug(slug)) {
    notFound()
  }

  const filePath = path.join(LEGAL_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) {
    notFound()
  }

  const raw = fs.readFileSync(filePath, "utf8")
  const { data, content } = matter(raw)

  return {
    data: data as LegalFrontmatter,
    content,
  }
}
