import type {
  AgentUsageGuide,
  AgentWorkflowGuide,
  JsonValue,
} from "@/lib/types/models"

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const items = value.filter((item): item is string => typeof item === "string")
  return items.length > 0 ? items : undefined
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isJsonObject(value)) {
    return undefined
  }

  const result: Record<string, string> = {}

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      result[key] = item
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}

function sanitizeJsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }

  if (Array.isArray(value)) {
    const result: JsonValue[] = []

    for (const item of value) {
      const sanitized = sanitizeJsonValue(item)
      if (sanitized !== undefined) {
        result.push(sanitized)
      }
    }

    return result
  }

  if (isJsonObject(value)) {
    const result: { [key: string]: JsonValue } = {}

    for (const [key, item] of Object.entries(value)) {
      const sanitized = sanitizeJsonValue(item)
      if (sanitized !== undefined) {
        result[key] = sanitized
      }
    }

    return result
  }

  return undefined
}

export function parseAgentUsageGuide(value: unknown): AgentUsageGuide | null {
  if (!isJsonObject(value)) {
    return null
  }

  const workflows = Array.isArray(value.workflows)
    ? value.workflows
        .map((workflow): AgentWorkflowGuide | null => {
          if (!isJsonObject(workflow)) {
            return null
          }

          if (typeof workflow.id !== "string" || typeof workflow.name !== "string") {
            return null
          }

          const promptTemplate = isJsonObject(workflow.promptTemplate)
            ? {
                mode:
                  typeof workflow.promptTemplate.mode === "string"
                    ? workflow.promptTemplate.mode
                    : undefined,
                template: sanitizeJsonValue(workflow.promptTemplate.template),
              }
            : undefined

          return {
            id: workflow.id,
            name: workflow.name,
            active: typeof workflow.active === "boolean" ? workflow.active : undefined,
            priority:
              typeof workflow.priority === "number"
                ? workflow.priority
                : workflow.priority == null
                  ? undefined
                  : Number(workflow.priority),
            bestFor: toStringArray(workflow.bestFor),
            whenToUse: toStringArray(workflow.whenToUse),
            requiredInputs: toStringArray(workflow.requiredInputs),
            followupQuestions: toStringArray(workflow.followupQuestions),
            inputRoleRules: toStringArray(workflow.inputRoleRules),
            promptTemplate:
              promptTemplate && (promptTemplate.mode || promptTemplate.template !== undefined)
                ? promptTemplate
                : undefined,
            pitfalls: toStringArray(workflow.pitfalls),
          }
        })
        .filter((workflow): workflow is AgentWorkflowGuide => workflow !== null)
    : undefined

  const parsed: AgentUsageGuide = {
    agentSummary: typeof value.agentSummary === "string" ? value.agentSummary : undefined,
    bestFor: toStringArray(value.bestFor),
    avoidFor: toStringArray(value.avoidFor),
    inputSemantics: toStringRecord(value.inputSemantics),
    routingRules: toStringArray(value.routingRules),
    promptGuidance: toStringArray(value.promptGuidance),
    pitfalls: toStringArray(value.pitfalls),
    workflows: workflows && workflows.length > 0 ? workflows : undefined,
  }

  return Object.values(parsed).some((entry) => entry !== undefined) ? parsed : null
}
