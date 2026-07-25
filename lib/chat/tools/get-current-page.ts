import { tool } from "ai"
import { z } from "zod"

import { resolveAppPageContext } from "@/lib/chat/page-context"

interface CreateGetCurrentPageToolOptions {
  pagePath?: string
}

export function createGetCurrentPageTool({ pagePath }: CreateGetCurrentPageToolOptions) {
  return tool({
    description:
      "Load structured context for the page the user is currently viewing in the app (pathname from the client). Call this when they ask about this page, this guide, the steps here, what to do next on this screen, or refer to content they are reading. Returns a slim summary — not a full article dump. Prefer this over guessing from the path alone.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!pagePath) {
        return {
          kind: "unavailable" as const,
          message:
            "Current page path was not provided with this chat request. Ask the user which page or guide they mean.",
        }
      }

      return resolveAppPageContext(pagePath)
    },
  })
}
