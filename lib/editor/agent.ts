import type { UIMessage } from "ai"
import { applyAgentCommand, findItemById } from "@/lib/editor/commands"
import type {
  AgentCommand,
  AgentCommandLogEntry,
  AgentExecutionStep,
  EditorAgentSession,
  EditorProject,
  PendingAgentAction,
  TimelineItem,
} from "@/lib/editor/types"
import { makeId } from "@/lib/editor/utils"

type MessageFilePart = Extract<UIMessage["parts"][number], { type: "file" }>

interface InterpretRequestOptions {
  project: EditorProject
  messages: UIMessage[]
  session: EditorAgentSession
  selectionItemIds: string[]
  playheadFrame: number
  availableMedia?: AgentAvailableMedia[]
}

interface ClauseContext {
  project: EditorProject
  clause: string
  selectionItemIds: string[]
  playheadFrame: number
  files: MessageFilePart[]
  fileCursor: number
  availableMedia: AgentAvailableMedia[]
}

export interface AgentAvailableMedia {
  id: string
  title: string
  url: string
  type: "video" | "image" | "audio"
  mediaType?: string
}

interface ClauseOutcome {
  type: "executed" | "pending-confirmation" | "clarify" | "none" | "export"
  command?: AgentCommand
  nextProject?: EditorProject
  nextSelectionItemIds?: string[]
  consumedFileCount?: number
  pendingAction?: PendingAgentAction
  step?: AgentExecutionStep
  reply?: string
}

export interface AgentInterpretationResult {
  type:
    | "executed"
    | "pending-confirmation"
    | "clarify"
    | "cancelled"
    | "none"
    | "export"
  reply: string
  nextProject?: EditorProject
  pendingAction?: PendingAgentAction | null
  command?: AgentCommand
  logEntry?: AgentCommandLogEntry
}

function getLatestUserMessage(messages: UIMessage[]): UIMessage | undefined {
  return [...messages].reverse().find((message) => message.role === "user")
}

export function getLatestUserText(messages: UIMessage[]): string {
  const message = getLatestUserMessage(messages)
  if (!message) return ""

  return message.parts
    .filter(
      (part): part is Extract<UIMessage["parts"][number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("\n")
    .trim()
}

function getLatestUserFiles(messages: UIMessage[]): MessageFilePart[] {
  const message = getLatestUserMessage(messages)
  if (!message) return []

  return message.parts.filter(
    (part): part is MessageFilePart =>
      part.type === "file" && typeof part.url === "string",
  )
}

function isConfirmationText(text: string): boolean {
  return /\b(yes|confirm|do it|go ahead|approve|delete it)\b/i.test(text)
}

function isRejectText(text: string): boolean {
  return /\b(no|cancel|stop|don't|do not)\b/i.test(text)
}

function getAllItems(project: EditorProject): TimelineItem[] {
  return project.timeline_state.tracks.flatMap((track) => track.items)
}

function findTargetItem(
  project: EditorProject,
  rawText: string,
  selectionItemIds: string[],
): TimelineItem | null {
  const selectedId = selectionItemIds[0]
  if (selectedId) {
    return findItemById(project.timeline_state, selectedId)?.item ?? null
  }

  const lowered = rawText.toLowerCase()
  const items = getAllItems(project)

  for (const item of items) {
    if (
      lowered.includes(item.id.toLowerCase()) ||
      lowered.includes(item.label.toLowerCase())
    ) {
      return item
    }
  }

  return items[0] ?? null
}

function inferFileType(
  mediaType: string | undefined,
  url: string,
): "video" | "image" | "audio" {
  if (mediaType?.startsWith("audio/")) return "audio"
  if (mediaType?.startsWith("image/")) return "image"
  if (mediaType?.startsWith("video/")) return "video"

  const lowered = url.toLowerCase()
  if (/\.(mp3|wav|aac|m4a)$/i.test(lowered)) return "audio"
  if (/\.(png|jpg|jpeg|webp|gif)$/i.test(lowered)) return "image"
  return "video"
}

function findMediaCandidate(
  clause: string,
  availableMedia: AgentAvailableMedia[],
): AgentAvailableMedia | null {
  const loweredClause = clause.toLowerCase()
  const meaningfulWords = loweredClause
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 1 &&
        ![
          "add",
          "insert",
          "place",
          "drop",
          "asset",
          "clip",
          "video",
          "image",
          "audio",
          "the",
          "my",
          "this",
          "that",
          "timeline",
        ].includes(word),
    )

  let bestMatch: { candidate: AgentAvailableMedia; score: number } | null = null

  for (const candidate of availableMedia) {
    const loweredTitle = candidate.title.toLowerCase()
    let score = 0

    if (loweredClause.includes(loweredTitle)) {
      score += 10
    }

    for (const word of meaningfulWords) {
      if (loweredTitle.includes(word)) {
        score += 2
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { candidate, score }
    }
  }

  return bestMatch?.candidate ?? null
}

function splitIntoClauses(text: string): string[] {
  if (!text.trim()) return []

  const normalized = text
    .replace(/\r/g, " ")
    .replace(/\n+/g, " || ")
    .replace(/\bthen\b/gi, " || ")
    .replace(/\bafter that\b/gi, " || ")
    .replace(/;/g, " || ")
    .replace(
      /\s+\band\b\s+(?=(add|insert|place|drop|split|move|remove|delete|set|make|change|apply|mute|unmute|trim|render|export)\b)/gi,
      " || ",
    )

  return normalized
    .split("||")
    .map((clause) => clause.trim())
    .filter(Boolean)
    .slice(0, 5)
}

function makeExecutionStep(
  index: number,
  label: string,
  summary: string,
  status: AgentExecutionStep["status"],
  command?: AgentCommand,
): AgentExecutionStep {
  return {
    id: makeId("step"),
    index,
    label,
    summary,
    status,
    command,
  }
}

function getNewlyAddedItemId(
  previousProject: EditorProject,
  nextProject: EditorProject,
): string | null {
  const beforeIds = new Set(getAllItems(previousProject).map((item) => item.id))
  return getAllItems(nextProject).find((item) => !beforeIds.has(item.id))?.id ?? null
}

function executeCommand(
  project: EditorProject,
  command: AgentCommand,
): EditorProject {
  return applyAgentCommand(project, command)
}

function interpretClause({
  project,
  clause,
  selectionItemIds,
  playheadFrame,
  files,
  fileCursor,
  availableMedia,
}: ClauseContext): ClauseOutcome {
  const lowered = clause.toLowerCase()

  if (/\b(render|export)\b/i.test(clause)) {
    return {
      type: "export",
      command: {
        type: "start-export",
      },
      step: makeExecutionStep(
        0,
        "Queue export",
        "Export jobs still need the Remotion provider worker configured.",
        "skipped",
        {
          type: "start-export",
        },
      ),
    }
  }

  if (/\b(add|insert|place)\b/i.test(clause) && /\btext\b/i.test(clause)) {
    const textMatch = clause.match(/"(.+?)"/) ?? clause.match(/text\s+(.+)/i)
    const nextText = textMatch?.[1]?.trim() || "New title"
    const command: AgentCommand = {
      type: "add-text",
      payload: {
        text: nextText,
        startFrame: playheadFrame,
        durationInFrames: 150,
      },
    }
    const nextProject = executeCommand(project, command)
    const nextSelectionItemId = getNewlyAddedItemId(project, nextProject)

    return {
      type: "executed",
      command,
      nextProject,
      nextSelectionItemIds: nextSelectionItemId ? [nextSelectionItemId] : selectionItemIds,
      step: makeExecutionStep(
        0,
        "Add text",
        `Added text overlay "${nextText}" at the current playhead.`,
        "executed",
        command,
      ),
    }
  }

  if (/\b(add|insert|place|drop)\b/i.test(clause)) {
    const explicitUrl = clause.match(/(https?:\/\/\S+)/i)?.[1]
    const file = explicitUrl ? undefined : files[fileCursor]
    const mediaCandidate =
      explicitUrl || file ? null : findMediaCandidate(clause, availableMedia)
    const url = explicitUrl ?? file?.url ?? mediaCandidate?.url

    if (url) {
      const type = mediaCandidate?.type ?? inferFileType(file?.mediaType, url)
      const label =
        mediaCandidate?.title ||
        file?.filename ||
        url.split("/").pop() ||
        `${type} clip`
      const command: AgentCommand = {
        type: "add-asset",
        payload: {
          type,
          src: url,
          label,
          durationInFrames: type === "image" ? 150 : 180,
          startFrame: playheadFrame,
          mediaType: file?.mediaType ?? mediaCandidate?.mediaType,
        },
      }
      const nextProject = executeCommand(project, command)
      const nextSelectionItemId = getNewlyAddedItemId(project, nextProject)

      return {
        type: "executed",
        command,
        nextProject,
        nextSelectionItemIds: nextSelectionItemId ? [nextSelectionItemId] : selectionItemIds,
        consumedFileCount: explicitUrl ? 0 : 1,
        step: makeExecutionStep(
          0,
          "Add asset",
          `Added ${label} to the timeline at the current playhead.`,
          "executed",
          command,
        ),
      }
    }
  }

  const target = findTargetItem(project, clause, selectionItemIds)

  if (/\bsplit\b/i.test(clause)) {
    if (!target) {
      return {
        type: "clarify",
        reply: "Select a clip first, then ask me to split it at the playhead.",
      }
    }

    const command: AgentCommand = {
      type: "split-item",
      targetItemId: target.id,
      payload: { splitFrame: playheadFrame },
    }

    return {
      type: "executed",
      command,
      nextProject: executeCommand(project, command),
      nextSelectionItemIds: [target.id],
      step: makeExecutionStep(
        0,
        "Split clip",
        `Split ${target.label} at the current playhead.`,
        "executed",
        command,
      ),
    }
  }

  const speedMatch =
    clause.match(/(\d+(\.\d+)?)x/) ??
    (/faster/i.test(clause) ? ["1.5", "1.5"] : null) ??
    (/slower/i.test(clause) ? ["0.75", "0.75"] : null)

  if (/\b(speed|playback|faster|slower)\b/i.test(clause) && speedMatch) {
    if (!target) {
      return {
        type: "clarify",
        reply: "Select a clip first or mention its label so I know which item's speed to change.",
      }
    }

    const playbackRate = Number(speedMatch[1])
    const command: AgentCommand = {
      type: "change-speed",
      targetItemId: target.id,
      payload: { playbackRate },
    }

    return {
      type: "executed",
      command,
      nextProject: executeCommand(project, command),
      nextSelectionItemIds: [target.id],
      step: makeExecutionStep(
        0,
        "Change speed",
        `Changed ${target.label} to ${playbackRate}x speed.`,
        "executed",
        command,
      ),
    }
  }

  const moveMatch = clause.match(/to\s+(\d+(\.\d+)?)\s*(s|sec|seconds)\b/i)
  if (/\bmove\b/i.test(clause) && moveMatch) {
    if (!target) {
      return {
        type: "clarify",
        reply: "Select a clip first or mention its label so I know what to move.",
      }
    }

    const seconds = Number(moveMatch[1])
    const startFrame = Math.round(seconds * project.composition_settings.fps)
    const command: AgentCommand = {
      type: "move-item",
      targetItemId: target.id,
      payload: { startFrame },
    }

    return {
      type: "executed",
      command,
      nextProject: executeCommand(project, command),
      nextSelectionItemIds: [target.id],
      step: makeExecutionStep(
        0,
        "Move clip",
        `Moved ${target.label} to ${seconds}s.`,
        "executed",
        command,
      ),
    }
  }

  const volumeMatch = clause.match(/(\d+)\s*%/)
  if (/\b(volume|mute|unmute)\b/i.test(lowered)) {
    if (!target) {
      return {
        type: "clarify",
        reply: "Select a clip first or mention its label so I know which audio settings to change.",
      }
    }

    const muted = /\bmute\b/i.test(lowered) && !/\bunmute\b/i.test(lowered)
    const volume = muted ? 0 : volumeMatch ? Number(volumeMatch[1]) / 100 : 1
    const command: AgentCommand = {
      type: "change-volume",
      targetItemId: target.id,
      payload: { volume, muted },
    }

    return {
      type: "executed",
      command,
      nextProject: executeCommand(project, command),
      nextSelectionItemIds: [target.id],
      step: makeExecutionStep(
        0,
        muted ? "Mute clip" : "Change volume",
        muted
          ? `Muted ${target.label}.`
          : `Set ${target.label} volume to ${Math.round(volume * 100)}%.`,
        "executed",
        command,
      ),
    }
  }

  if (/\b(crossfade|fade black|fade to black)\b/i.test(lowered)) {
    if (!target) {
      return {
        type: "clarify",
        reply: "Select a clip first or mention its label so I know which transition to apply.",
      }
    }

    const type = /fade black|fade to black/i.test(lowered)
      ? "fade-black"
      : "crossfade"
    const command: AgentCommand = {
      type: "apply-transition",
      targetItemId: target.id,
      payload: { type, durationInFrames: 12 },
    }

    return {
      type: "executed",
      command,
      nextProject: executeCommand(project, command),
      nextSelectionItemIds: [target.id],
      step: makeExecutionStep(
        0,
        "Apply transition",
        `Applied a ${type === "fade-black" ? "fade-to-black" : "crossfade"} transition to ${target.label}.`,
        "executed",
        command,
      ),
    }
  }

  if (/\b(remove|delete)\b/i.test(lowered)) {
    if (!target) {
      return {
        type: "clarify",
        reply: "I couldn't find a timeline item to remove. Select a clip first or mention its label.",
      }
    }

    const command: AgentCommand = {
      type: "remove-item",
      targetItemId: target.id,
    }
    const pendingAction: PendingAgentAction = {
      id: makeId("pending"),
      label: `Remove ${target.label}`,
      requiresConfirmation: true,
      createdAt: new Date().toISOString(),
      command,
    }

    return {
      type: "pending-confirmation",
      command,
      pendingAction,
      step: makeExecutionStep(
        0,
        "Remove clip",
        `Waiting for confirmation to remove ${target.label}.`,
        "pending_confirmation",
        command,
      ),
      reply: `I can remove ${target.label}. Reply with "yes" to confirm.`,
    }
  }

  return { type: "none" }
}

export function interpretAgentRequest({
  project,
  messages,
  session,
  selectionItemIds,
  playheadFrame,
  availableMedia = [],
}: InterpretRequestOptions): AgentInterpretationResult {
  const userText = getLatestUserText(messages)
  const files = getLatestUserFiles(messages)

  if (session.pending_action && isConfirmationText(userText)) {
    const nextProject = applyAgentCommand(project, session.pending_action.command)
    const step = makeExecutionStep(
      1,
      session.pending_action.label,
      `Applied the pending action: ${session.pending_action.label}.`,
      "executed",
      session.pending_action.command,
    )

    return {
      type: "executed",
      reply: step.summary,
      nextProject,
      pendingAction: null,
      command: session.pending_action.command,
      logEntry: {
        id: makeId("log"),
        createdAt: new Date().toISOString(),
        summary: step.summary,
        command: session.pending_action.command,
        steps: [step],
      },
    }
  }

  if (session.pending_action && isRejectText(userText)) {
    return {
      type: "cancelled",
      reply: "Cancelled the pending timeline change.",
      pendingAction: null,
    }
  }

  const clauses = splitIntoClauses(userText)
  if (clauses.length === 0) {
    return {
      type: "none",
      reply:
        "I can control the timeline for this project. Try commands like add text, add this video, split selected clip, move it to 4 seconds, set it to 1.5x speed, or apply a crossfade.",
    }
  }

  let workingProject = project
  let activeSelectionItemIds = [...selectionItemIds]
  let fileCursor = 0
  let pendingAction: PendingAgentAction | null = null
  const executedSteps: AgentExecutionStep[] = []

  for (let index = 0; index < clauses.length; index += 1) {
    const outcome = interpretClause({
      project: workingProject,
      clause: clauses[index],
      selectionItemIds: activeSelectionItemIds,
      playheadFrame,
      files,
      fileCursor,
      availableMedia,
    })

    if (outcome.type === "export") {
      if (clauses.length > 1) {
        executedSteps.push(
          makeExecutionStep(
            executedSteps.length + 1,
            "Queue export",
            "Export needs to be run as its own request right now.",
            "skipped",
            outcome.command,
          ),
        )
        break
      }

      return {
        type: "export",
        reply: "Starting an export job for this project.",
        command: outcome.command,
        logEntry: {
          id: makeId("log"),
          createdAt: new Date().toISOString(),
          summary: "Requested project export.",
          command: outcome.command ?? { type: "start-export" },
          steps: [
            makeExecutionStep(
              1,
              "Queue export",
              "Requested export for the current project.",
              "executed",
              outcome.command,
            ),
          ],
        },
      }
    }

    if (outcome.type === "clarify") {
      if (executedSteps.length === 0) {
        return {
          type: "clarify",
          reply:
            outcome.reply ??
            "I need a little more detail before I can continue with that request.",
        }
      }

      executedSteps.push(
        makeExecutionStep(
          executedSteps.length + 1,
          "Needs clarification",
          outcome.reply ??
            "I stopped because one of the requested steps was ambiguous.",
          "skipped",
        ),
      )
      break
    }

    if (outcome.type === "pending-confirmation") {
      pendingAction = outcome.pendingAction ?? null
      executedSteps.push({
        ...(outcome.step ??
          makeExecutionStep(
            executedSteps.length + 1,
            "Pending confirmation",
            outcome.reply ?? "Waiting for confirmation.",
            "pending_confirmation",
            outcome.command,
          )),
        index: executedSteps.length + 1,
      })
      break
    }

    if (outcome.type === "executed" && outcome.nextProject && outcome.step) {
      workingProject = outcome.nextProject
      activeSelectionItemIds =
        outcome.nextSelectionItemIds ?? activeSelectionItemIds
      fileCursor += outcome.consumedFileCount ?? 0
      executedSteps.push({
        ...outcome.step,
        index: executedSteps.length + 1,
      })
    }
  }

  if (executedSteps.length === 0) {
    return {
      type: "none",
      reply:
        "I can control the timeline for this project. Try commands like add text, add this video, split selected clip, move it to 4 seconds, set it to 1.5x speed, or apply a crossfade.",
    }
  }

  const executedCount = executedSteps.filter((step) => step.status === "executed").length
  const summary = pendingAction
    ? `Executed ${executedCount} step${executedCount === 1 ? "" : "s"} and paused for confirmation on the next action.`
    : `Executed ${executedCount} step${executedCount === 1 ? "" : "s"} on the timeline.`
  const primaryCommand =
    executedSteps.find((step) => step.command)?.command ??
    pendingAction?.command ??
    { type: "inspect-project" as const }

  return {
    type: "executed",
    reply: [
      summary,
      ...executedSteps.map((step) => `${step.index}. ${step.summary}`),
    ].join("\n"),
    nextProject: workingProject,
    pendingAction,
    command: primaryCommand,
    logEntry: {
      id: makeId("log"),
      createdAt: new Date().toISOString(),
      summary,
      command: primaryCommand,
      steps: executedSteps,
    },
  }
}
