/**
 * Produce raw.githubusercontent.com URLs to fetch for a pasted GitHub link.
 */

export function githubRawUrlCandidates(input: string): string[] {
  const trimmed = input.trim()
  if (!trimmed) {
    return []
  }

  try {
    const withScheme = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`
    const u = new URL(withScheme)
    const host = u.hostname.replace(/^www\./, "")

    if (host === "raw.githubusercontent.com") {
      return [u.toString()]
    }

    if (host !== "github.com") {
      return []
    }

    const parts = u.pathname.split("/").filter(Boolean)
    if (parts.length < 2) {
      return []
    }

    const owner = parts[0]!
    const repo = parts[1]!.replace(/\.git$/, "")
    const base = `https://raw.githubusercontent.com/${owner}/${repo}`

    if (parts[2] === "blob" && parts.length >= 5) {
      const ref = parts[3]!
      const path = parts.slice(4).join("/")
      return [`${base}/${ref}/${path}`]
    }

    if (parts[2] === "tree") {
      if (parts.length === 4) {
        const ref = parts[3]!
        return [`${base}/${ref}/SKILL.md`]
      }
      if (parts.length >= 5) {
        const ref = parts[3]!
        const path = parts.slice(4).join("/")
        return [`${base}/${ref}/${path}`]
      }
    }

    if (parts.length === 2) {
      return [`${base}/main/SKILL.md`, `${base}/master/SKILL.md`]
    }

    return []
  } catch {
    return []
  }
}
