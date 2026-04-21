import type {
  AutomationPromptPayload,
  AutomationPromptVariable,
  AutomationPromptVariableItem,
} from "@/lib/automations/prompt-payload"

export type ResolveVariablesResult = {
  resolved: AutomationPromptPayload
  cursorUpdates: Record<string, number>
}

function pickItem(
  variable: AutomationPromptVariable,
  rng: () => number,
): { item: AutomationPromptVariableItem; nextCursor?: number } {
  const { items, mode, cursor } = variable
  const len = items.length
  if (len === 0) {
    throw new Error("empty items")
  }
  if (mode === "random") {
    const idx = Math.floor(rng() * len)
    return { item: items[idx]! }
  }
  const idx = (cursor ?? 0) % len
  const nextCursor = (idx + 1) % len
  return { item: items[idx]!, nextCursor }
}

function replaceToken(text: string, varId: string, replacement: string): string {
  const token = `{{${varId}}}`
  if (!text.includes(token)) return text
  return text.split(token).join(replacement)
}

function hasRef(refs: AutomationPromptPayload["refs"], id: string): boolean {
  return refs.some((r) => r.id === id)
}

/**
 * Resolves `{{varId}}` placeholders using each variable's items (random or sequential).
 * Sequential mode returns cursorUpdates to persist after a successful run.
 */
export function resolveAutomationVariables(
  payload: AutomationPromptPayload,
  rng: () => number = Math.random,
): ResolveVariablesResult {
  const variables = payload.variables
  if (!variables || variables.length === 0) {
    return {
      resolved: { ...payload, variables: undefined },
      cursorUpdates: {},
    }
  }

  let text = payload.text
  const refs = [...payload.refs]
  const attachments = [...payload.attachments]
  const cursorUpdates: Record<string, number> = {}

  for (const variable of variables) {
    const { id, items } = variable
    if (items.length === 0) continue
    const token = `{{${id}}}`
    if (!text.includes(token)) continue

    let picked: AutomationPromptVariableItem
    let nextCursor: number | undefined
    try {
      const result = pickItem(variable, rng)
      picked = result.item
      nextCursor = result.nextCursor
    } catch {
      continue
    }

    if (variable.mode === "sequential" && nextCursor !== undefined) {
      cursorUpdates[id] = nextCursor
    }

    switch (picked.kind) {
      case "text":
        text = replaceToken(text, id, picked.value)
        break
      case "attachment":
        text = replaceToken(text, id, "")
        attachments.push({
          url: picked.url,
          mediaType: picked.mediaType,
          ...(picked.filename ? { filename: picked.filename } : {}),
        })
        break
      case "ref": {
        const ref = picked.ref
        text = replaceToken(text, id, ref.mentionToken)
        if (!hasRef(refs, ref.id)) {
          refs.push(ref)
        }
        break
      }
    }
  }

  return {
    resolved: {
      text,
      refs,
      attachments,
      variables: undefined,
    },
    cursorUpdates,
  }
}

/**
 * Merges cursor updates from a run into the stored variables array.
 */
export function mergeVariableCursors(
  variables: AutomationPromptVariable[] | undefined,
  cursorUpdates: Record<string, number>,
): AutomationPromptVariable[] | undefined {
  if (!variables || variables.length === 0 || Object.keys(cursorUpdates).length === 0) {
    return variables
  }
  return variables.map((v) => {
    const next = cursorUpdates[v.id]
    if (next === undefined) return v
    return { ...v, cursor: next }
  })
}
