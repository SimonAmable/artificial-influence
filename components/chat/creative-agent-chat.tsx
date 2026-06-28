"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import type { UIMessage } from "ai"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai"
import { Chat, useChat } from "@ai-sdk/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowUp,
  Books,
  Check,
  CircleNotch,
  ClockCounterClockwise,
  FilePlus,
  FolderOpen,
  HandPalm,
  Lightning,
  NotePencil,
  Plus,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation"
import { SpeechInput } from "@/components/ai-elements/speech-input"
import { Message, MessageContent } from "@/components/ai-elements/message"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import {
  applyImageGridAgentAction,
  toImageGridAgentContext,
} from "@/lib/chat/image-grid-agent-actions"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { SkillEditModal } from "@/components/chat/skill-edit-modal"
import { SkillLoadModal } from "@/components/chat/skill-load-modal"
import { MessageParts } from "@/components/chat/message-parts"
import {
  attachedRefFromDroppedMediaUrl,
  brandReferencesOnly,
  ChatBrandPills,
  composerDropTypesAccept,
  ComposerAttachmentPreviews,
  filesToMessageParts,
  inferMediaTypeFromFile,
  PinnedSkillPills,
  REACTFLOW_NODE_MIME,
} from "@/components/chat/composer/attachments"
import type {
  ComposerAssetAttachment,
  ComposerAttachment,
  ComposerUploadAttachment,
  PinnedSkillSummary,
} from "@/components/chat/composer/types"
import type { ImageGridAgentAction } from "@/components/shared/display/image-grid"
import { Badge } from "@/components/ui/badge"
import { UserMessageMediaParts, UserMessageTextParts } from "@/components/chat/tool-ui/user-message-parts"
import { countUniqueSkillsLoadedInMessages } from "@/lib/chat/skills/loaded-in-messages"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CHAT_GATEWAY_MODEL_OPTIONS,
  DEFAULT_CHAT_GATEWAY_MODEL,
  getChatGatewayModelOption,
} from "@/lib/constants/chat-llm-models"
import { cn } from "@/lib/utils"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { extractAssetFromNode } from "@/lib/canvas/drag-utils"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { CommandTextarea } from "@/components/commands/command-textarea"
import type { AttachedRef } from "@/lib/commands/types"
import { extendMentionRangeEnd } from "@/lib/commands/mention-token"
import {
  refsToChatMetadata,
} from "@/lib/chat/reference-metadata"
import type {
  GenerateAudioToolPart,
  GenerateImageToolPart,
  GenerateVideoToolPart,
  InstagramConnectionToolSummary,
  SocialConnectionToolSummary,
  UniversalGenerateImageToolPart,
} from "@/lib/chat/agent-tool-part-types"
import { consumeDashboardAgentHandoff } from "@/lib/chat/dashboard-agent-handoff"
import { consumePendingTemplateHandoff } from "@/lib/templates/handoff"
import { buildActivateSkillPrompt, buildSkillSlashCommands, normalizeLeadingSkillSlashPrompt } from "@/lib/chat/skills/slash-skill-prompt"
import type { SkillPickerEntry } from "@/lib/chat/skills/catalog"
import {
  DEFAULT_GENERATION_APPROVAL_MODE,
  normalizeGenerationApprovalMode,
  type GenerationApprovalMode,
} from "@/lib/chat/generation-approval"
import { readStoredEditorProjectId } from "@/lib/video-editor/editor-project-context"

/** Serializable thread row for mobile history (matches ChatThreadListItem). */
type MobileChatThreadListItem = {
  id: string
  title: string
  updated_at: string
  source?: "user" | "automation"
  automation_trigger?: "manual" | "scheduled" | null
}

type PendingToolApprovalPart = {
  approval?: {
    approved?: boolean
    id?: unknown
    reason?: string
  }
  state?: unknown
  toolCallId?: unknown
  type?: unknown
}

type GenerationApprovalActionPart =
  | GenerateAudioToolPart
  | GenerateImageToolPart
  | GenerateVideoToolPart
  | UniversalGenerateImageToolPart

const GENERATION_APPROVAL_TOOL_TYPES = new Set([
  "tool-generateAudio",
  "tool-generateImage",
  "tool-generateImageWithNanoBanana",
  "tool-generateVideo",
])

function getPendingGenerationApprovalIds(messages: UIMessage[]) {
  const approvalIds: string[] = []

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      const toolPart = part as PendingToolApprovalPart
      if (
        typeof toolPart.type === "string" &&
        GENERATION_APPROVAL_TOOL_TYPES.has(toolPart.type) &&
        toolPart.state === "approval-requested" &&
        typeof toolPart.approval?.id === "string" &&
        typeof toolPart.toolCallId === "string"
      ) {
        approvalIds.push(toolPart.approval.id)
      }
    }
  }

  return approvalIds
}

function cancelPendingGenerationApprovals(messages: UIMessage[]) {
  let canceledCount = 0
  const reason = "User sent a revised message before approving generation."

  const nextMessages = messages.map((message) => {
    let changed = false
    const nextParts = (message.parts ?? []).map((part) => {
      const toolPart = part as PendingToolApprovalPart
      if (
        typeof toolPart.type === "string" &&
        GENERATION_APPROVAL_TOOL_TYPES.has(toolPart.type) &&
        toolPart.state === "approval-requested" &&
        typeof toolPart.approval?.id === "string" &&
        typeof toolPart.toolCallId === "string"
      ) {
        changed = true
        canceledCount += 1
        return {
          ...part,
          state: "output-denied",
          approval: {
            ...toolPart.approval,
            approved: false,
            id: toolPart.approval.id,
            reason,
          },
        } as typeof part
      }

      return part
    }) as UIMessage["parts"]

    return changed ? { ...message, parts: nextParts } : message
  })

  return { canceledCount, messages: nextMessages }
}

function markGenerationApprovalResponded(
  messages: UIMessage[],
  toolCallId: string,
  approved: boolean,
) {
  const nextMessages = messages.map((message) => {
    let changed = false
    const nextParts = (message.parts ?? []).map((part) => {
      const toolPart = part as PendingToolApprovalPart
      if (
        typeof toolPart.type === "string" &&
        GENERATION_APPROVAL_TOOL_TYPES.has(toolPart.type) &&
        toolPart.state === "approval-requested" &&
        toolPart.toolCallId === toolCallId
      ) {
        changed = true
        return {
          ...part,
          approval: toolPart.approval
            ? {
                ...toolPart.approval,
                approved,
              }
            : undefined,
          state: "approval-responded",
        } as typeof part
      }

      return part
    }) as UIMessage["parts"]

    return changed ? { ...message, parts: nextParts } : message
  })

  return nextMessages
}

function formatThreadUpdatedAt(value: string) {
  const date = new Date(value)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return "Just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

const EMPTY_STATE_TITLE = "What will we create today?"

const EMPTY_STATE_DESCRIPTION =
  "Copy the best carousels, ads, AI influencers, and AI UGC, all by chatting."

const STARTER_PROMPTS: { label: string; prompt: string }[] = [
  {
    label: "What can this agent do?",
    prompt: "What can this agent do?",
  },
  {
    label: "Recommend best model & workflow",
    prompt:
      "For my goal below, recommend the best model plus the workflow (steps, what to attach, and order). Keep it short and actionable.\n\nGoal: ",
  },
  {
    label: "Copy reference video or image",
    prompt:
      "Iâ€™m attaching a reference (image or video). Deeply analyze every important detail: subject, wardrobe, props, environment, lighting, color, composition, camera/lens feel, motion/pace, edits, text/UI, audio vibe if video. Output (1) if itâ€™s an image: a rich, valid JSON prompt package I can reuse (structured fields, not vague labels); (2) if itâ€™s video: a tight shot-by-shot script (beats, duration hints, motion, dialogue/voiceover if any, captions/SFX). Then (3) a concise but detailed plan to recreate it with our tools (order of steps, what to generate vs edit, what to attach next). Do not skip fine-grained elements that materially affect the look.",
  },
]

const EMPTY_MESSAGES: UIMessage[] = []
const CHAT_UI_BOOTSTRAP_STORAGE_PREFIX = "creative-chat-ui-bootstrap:"
const GENERATION_APPROVAL_STORAGE_KEY = "creative-chat-generation-approval-mode"

function readStoredGenerationApprovalMode(): GenerationApprovalMode {
  if (typeof window === "undefined") {
    return DEFAULT_GENERATION_APPROVAL_MODE
  }

  try {
    return normalizeGenerationApprovalMode(window.localStorage.getItem(GENERATION_APPROVAL_STORAGE_KEY))
  } catch {
    return DEFAULT_GENERATION_APPROVAL_MODE
  }
}

function storeGenerationApprovalMode(mode: GenerationApprovalMode) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(GENERATION_APPROVAL_STORAGE_KEY, mode)
  } catch {
    /* ignore quota / private mode */
  }
}

function readStoredChatBootstrapId(threadId: string): string | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.sessionStorage.getItem(`${CHAT_UI_BOOTSTRAP_STORAGE_PREFIX}${threadId}`)
  } catch {
    return null
  }
}

function storeChatBootstrapId(threadId: string, bootstrapId: string) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.sessionStorage.setItem(`${CHAT_UI_BOOTSTRAP_STORAGE_PREFIX}${threadId}`, bootstrapId)
  } catch {
    /* ignore quota / private mode */
  }
}

function clearStoredChatBootstrapId(threadId: string) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.sessionStorage.removeItem(`${CHAT_UI_BOOTSTRAP_STORAGE_PREFIX}${threadId}`)
  } catch {
    /* ignore */
  }
}

const ONBOARDING_HANDOFF_PROMPT =
  "I just finished onboarding. What is this app, and what should I do first based on my goals?"

export function CreativeAgentChat({
  compact = false,
  enablePersistence = false,
  initialMessages = EMPTY_MESSAGES,
  initialThreadId,
  mobileThreads,
  onThreadIdChange,
  syncUrlOnThreadCreate = false,
}: {
  compact?: boolean
  enablePersistence?: boolean
  initialMessages?: UIMessage[]
  initialThreadId?: string
  /** When set (e.g. logged-in chat page), shows mobile history dropdown + new chat bar. */
  mobileThreads?: MobileChatThreadListItem[]
  onThreadIdChange?: (threadId: string | undefined) => void
  syncUrlOnThreadCreate?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [assetModalOpen, setAssetModalOpen] = React.useState(false)
  const [pinnedSkills, setPinnedSkills] = React.useState<PinnedSkillSummary[]>([])
  const [skillLoadModalOpen, setSkillLoadModalOpen] = React.useState(false)
  const [skillEditModalSlug, setSkillEditModalSlug] = React.useState<string | null>(null)
  const [composerDropActive, setComposerDropActive] = React.useState(false)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [authReady, setAuthReady] = React.useState(false)
  const [composerValue, setComposerValue] = React.useState("")
  const [attachedFiles, setAttachedFiles] = React.useState<ComposerUploadAttachment[]>([])
  const [attachedRefs, setAttachedRefs] = React.useState<AttachedRef[]>([])
  const [availableSkills, setAvailableSkills] = React.useState<SkillPickerEntry[]>([])
  const [socialConnections, setSocialConnections] = React.useState<SocialConnectionToolSummary[]>([])
  const [threadId, setThreadId] = React.useState<string | undefined>(initialThreadId)
  const [isCreatingThread, setIsCreatingThread] = React.useState(false)
  const [isBootstrappingOnboarding, setIsBootstrappingOnboarding] = React.useState(false)
  const [createAssetDialogOpen, setCreateAssetDialogOpen] = React.useState(false)
  const [selectedImageForAsset, setSelectedImageForAsset] = React.useState<{
    url: string
    index: number
  } | null>(null)

  /** AI SDK Chat `id`; must stay stable while a draft thread upgrades to DB id or `useChat` wipes messages mid-send (see `@ai-sdk/react` use-chat). */
  const persistBootstrapRef = React.useRef<string | null>(null)
  const sidebarLikeEmbed =
    compact && enablePersistence && !syncUrlOnThreadCreate /* sheet chat only; `/chat` page sets syncUrl */
  const pageLikePersist =
    compact && enablePersistence && syncUrlOnThreadCreate /* full `/chat` page */
  const useStablePersistBootstrap = sidebarLikeEmbed || pageLikePersist
  const resolvedUiChatBootstrapId = useStablePersistBootstrap
    ? (persistBootstrapRef.current ??=
        (typeof initialThreadId === "string" && initialThreadId.length > 0
          ? readStoredChatBootstrapId(initialThreadId) ?? initialThreadId
          : null) ??
        `page-draft-${typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`)
    : (initialThreadId ?? "creative-chat-draft")

  const threadIdRef = React.useRef<string | undefined>(initialThreadId)
  const onboardingBootstrapInFlightRef = React.useRef(false)
  const onboardingHandoffPendingRef = React.useRef(false)
  const onboardingBootstrapCompletedRef = React.useRef(false)
  const dashboardHandoffConsumedRef = React.useRef(false)
  const templateHandoffCompletedRef = React.useRef(false)
  const chatGatewayModelRef = React.useRef<string>(DEFAULT_CHAT_GATEWAY_MODEL)
  const generationApprovalModeRef = React.useRef<GenerationApprovalMode>(DEFAULT_GENERATION_APPROVAL_MODE)
  const forceFullMessagesNextSendRef = React.useRef(false)
  const [chatGatewayModelId, setChatGatewayModelId] = React.useState<string>(DEFAULT_CHAT_GATEWAY_MODEL)
  const [generationApprovalMode, setGenerationApprovalMode] =
    React.useState<GenerationApprovalMode>(DEFAULT_GENERATION_APPROVAL_MODE)
  /** One `router.refresh()` per thread ID so sidebar thread titles reflect async intent renaming. */
  const intentSidebarRefreshedForThreadIdsRef = React.useRef(new Set<string>())
  const pathnameRef = React.useRef(pathname)
  const syncedInitialThreadIdRef = React.useRef<string | undefined>(initialThreadId)

  React.useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  React.useEffect(() => {
    const storedMode = readStoredGenerationApprovalMode()
    generationApprovalModeRef.current = storedMode
    setGenerationApprovalMode(storedMode)
  }, [])

  const updateGenerationApprovalMode = React.useCallback((mode: GenerationApprovalMode) => {
    generationApprovalModeRef.current = mode
    setGenerationApprovalMode(mode)
    storeGenerationApprovalMode(mode)
  }, [])

  const getLoginHref = React.useCallback(() => {
    if (typeof window === "undefined") {
      return "/login"
    }

    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const params = new URLSearchParams()
    params.set("next", next)
    return `/login?${params.toString()}`
  }, [])

  const selectedChatGatewayOption = React.useMemo(
    () => getChatGatewayModelOption(chatGatewayModelId),
    [chatGatewayModelId],
  )

  const initialMessagesRef = React.useRef(initialMessages)
  const enablePersistenceRef = React.useRef(enablePersistence)
  const syncUrlOnThreadCreateRef = React.useRef(syncUrlOnThreadCreate)
  const routerRef = React.useRef(router)

  React.useEffect(() => {
    initialMessagesRef.current = initialMessages
  }, [initialMessages])

  React.useEffect(() => {
    enablePersistenceRef.current = enablePersistence
  }, [enablePersistence])

  React.useEffect(() => {
    syncUrlOnThreadCreateRef.current = syncUrlOnThreadCreate
  }, [syncUrlOnThreadCreate])

  React.useEffect(() => {
    routerRef.current = router
  }, [router])

  const chat = React.useMemo(
    () =>
      new Chat({
        id: resolvedUiChatBootstrapId,
        messages: initialMessagesRef.current,
        onFinish: () => {
          const activeThreadId = threadIdRef.current

          const threadHref = activeThreadId ? `/chat/${activeThreadId}` : null

          if (enablePersistenceRef.current && syncUrlOnThreadCreateRef.current && threadHref && pathnameRef.current !== threadHref) {
            routerRef.current.replace(threadHref)
          }

          if (enablePersistenceRef.current && activeThreadId) {
            const refreshed = intentSidebarRefreshedForThreadIdsRef.current
            if (!refreshed.has(activeThreadId)) {
              refreshed.add(activeThreadId)
              routerRef.current.refresh()
              /** Second pass after intent-title LLM (waitUntil) updates the DB. */
              window.setTimeout(() => {
                routerRef.current.refresh()
              }, 3200)
            }
          }
        },
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
        transport: new DefaultChatTransport({
          api: "/api/chat",
          prepareSendMessagesRequest: ({ messages }) => {
            const model = chatGatewayModelRef.current
            const generationApprovalMode = generationApprovalModeRef.current
            const editorProjectId = readStoredEditorProjectId()
            const forceFullMessages = forceFullMessagesNextSendRef.current
            if (forceFullMessages) {
              forceFullMessagesNextSendRef.current = false
            }
            const onboardingHandoff = onboardingHandoffPendingRef.current
            if (onboardingHandoff) {
              onboardingHandoffPendingRef.current = false
            }
            if (enablePersistenceRef.current && threadIdRef.current && messages.length > 0 && !forceFullMessages) {
              return {
                body: {
                  message: messages[messages.length - 1],
                  generationApprovalMode,
                  mode: "chat",
                  model,
                  ...(editorProjectId ? { editorProjectId } : {}),
                  ...(onboardingHandoff ? { onboardingHandoff: true } : {}),
                  threadId: threadIdRef.current,
                },
              }
            }

            return {
              body: {
                messages,
                generationApprovalMode,
                mode: "chat",
                model,
                ...(editorProjectId ? { editorProjectId } : {}),
                ...(onboardingHandoff ? { onboardingHandoff: true } : {}),
                threadId: threadIdRef.current,
              },
            }
          },
        }),
      }),
    [resolvedUiChatBootstrapId],
  )

  const { addToolApprovalResponse, messages, sendMessage, setMessages, status, error, stop } = useChat({
    chat,
    experimental_throttle: 50,
  })

  const queuedComposerSendRef = React.useRef<{
    message: Parameters<typeof sendMessage>[0]
    restoreAttachedFiles: ComposerUploadAttachment[]
    restoreAttachedRefs: AttachedRef[]
    restoreComposerValue: string
  } | null>(null)

  const loadedSkillsCount = React.useMemo(
    () => countUniqueSkillsLoadedInMessages(messages),
    [messages],
  )
  const pendingGenerationApprovalIds = React.useMemo(
    () => getPendingGenerationApprovalIds(messages),
    [messages],
  )

  React.useEffect(() => {
    if (!queuedComposerSendRef.current) {
      return
    }

    if (status === "submitted" || status === "streaming") {
      return
    }

    if (status === "error") {
      const queued = queuedComposerSendRef.current
      queuedComposerSendRef.current = null
      setComposerValue(queued.restoreComposerValue)
      setAttachedFiles(queued.restoreAttachedFiles)
      setAttachedRefs(queued.restoreAttachedRefs)
      toast.error(error?.message || "Could not send message. Please try again.")
      return
    }

    if (pendingGenerationApprovalIds.length > 0) {
      return
    }

    const queued = queuedComposerSendRef.current
    queuedComposerSendRef.current = null
    forceFullMessagesNextSendRef.current = true

    void sendMessage(queued.message).catch((sendError) => {
      forceFullMessagesNextSendRef.current = false
      setComposerValue(queued.restoreComposerValue)
      setAttachedFiles(queued.restoreAttachedFiles)
      setAttachedRefs(queued.restoreAttachedRefs)
      toast.error(sendError instanceof Error ? sendError.message : "Could not send message.")
    })
  }, [error, pendingGenerationApprovalIds.length, sendMessage, status])

  const chatSlashCommands = React.useMemo(
    () => buildSkillSlashCommands(availableSkills),
    [availableSkills],
  )

  const refreshPinnedSkills = React.useCallback(async () => {
    if (!userId) {
      setPinnedSkills([])
      return
    }

    const response = await fetch("/api/skills/pins", { credentials: "same-origin" })
    const data = (await response.json().catch(() => ({}))) as {
      error?: string
      pinnedSkills?: PinnedSkillSummary[]
    }

    if (!response.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Could not load pinned skills.")
    }

    setPinnedSkills(Array.isArray(data.pinnedSkills) ? data.pinnedSkills : [])
  }, [userId])

  const refreshAvailableSkills = React.useCallback(async () => {
    if (!userId) {
      setAvailableSkills([])
      return
    }

    const response = await fetch("/api/skills", { credentials: "same-origin" })
    const data = (await response.json().catch(() => ({}))) as {
      error?: string
      skills?: SkillPickerEntry[]
    }

    if (!response.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Could not load skills.")
    }

    setAvailableSkills(Array.isArray(data.skills) ? data.skills : [])
  }, [userId])

  React.useEffect(() => {
    const supabase = createSupabaseClient()

    let cancelled = false
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return
        setUserId(data.user?.id ?? null)
        setAuthReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setUserId(null)
        setAuthReady(true)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
      setAuthReady(true)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  React.useEffect(() => {
    if (!authReady) {
      return
    }

    if (!userId) {
      setPinnedSkills([])
      setAvailableSkills([])
      return
    }

    void refreshPinnedSkills().catch((error: unknown) => {
      console.error("[chat] Failed to load pinned skills:", error)
      setPinnedSkills([])
    })
    void refreshAvailableSkills().catch((error: unknown) => {
      console.error("[chat] Failed to load skills for slash commands:", error)
      setAvailableSkills([])
    })
  }, [authReady, refreshAvailableSkills, refreshPinnedSkills, userId])

  React.useEffect(() => {
    if (!authReady || !userId) {
      setSocialConnections([])
      return
    }

    let cancelled = false

    void fetch("/api/social-connections/status", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load social accounts.")
        }
        return response.json() as Promise<{
          providers?: {
            instagram?: {
              connections?: SocialConnectionToolSummary[]
            }
            tiktok?: {
              connections?: SocialConnectionToolSummary[]
            }
          }
        }>
      })
      .then((data) => {
        if (cancelled) return
        const connections = [
          ...(data.providers?.instagram?.connections ?? []),
          ...(data.providers?.tiktok?.connections ?? []),
        ]

        setSocialConnections(
          connections.map((connection) => ({
            accountType: connection.accountType ?? null,
            displayName: connection.displayName ?? null,
            id: connection.id,
            instagramConnectionId: connection.instagramConnectionId ?? null,
            instagramUserId: connection.instagramUserId ?? null,
            profileFetchedAt: connection.profileFetchedAt ?? null,
            provider: connection.provider,
            scopes: Array.isArray(connection.scopes) ? connection.scopes : [],
            status: connection.status,
            tokenExpiresAt: connection.tokenExpiresAt ?? null,
            updatedAt: connection.updatedAt,
            username: connection.username ?? null,
          })),
        )
      })
      .catch(() => {
        if (cancelled) return
        setSocialConnections([])
      })

    return () => {
      cancelled = true
    }
  }, [authReady, userId])

  const socialConnectionsById = React.useMemo(
    () => new Map(socialConnections.map((connection) => [connection.id, connection])),
    [socialConnections],
  )

  const instagramConnectionsById = React.useMemo(
    () =>
      new Map(
        socialConnections.flatMap((connection) =>
          connection.provider === "instagram" && connection.instagramConnectionId
            ? [[
                connection.instagramConnectionId,
                {
                  accountType: connection.accountType ?? null,
                  id: connection.instagramConnectionId,
                  instagramUserId: connection.instagramUserId ?? null,
                  instagramUsername: connection.username ?? connection.displayName ?? null,
                  profileFetchedAt: connection.profileFetchedAt ?? null,
                  tokenExpiresAt: connection.tokenExpiresAt ?? null,
                  updatedAt: connection.updatedAt,
                } satisfies InstagramConnectionToolSummary,
              ]]
            : [],
        ),
      ),
    [socialConnections],
  )

  const assetAttachments = React.useMemo<ComposerAssetAttachment[]>(
    () =>
      attachedRefs.flatMap((ref) => {
        if (ref.category !== "asset" || !ref.assetUrl || !ref.assetType) {
          return []
        }

        return [
          {
            assetType: ref.assetType,
            id: ref.chipId,
            ref,
            source: "asset" as const,
            title: ref.label,
            url: ref.assetUrl,
          },
        ]
      }),
    [attachedRefs],
  )

  const composerAttachments = React.useMemo<ComposerAttachment[]>(
    () => [...attachedFiles, ...assetAttachments],
    [assetAttachments, attachedFiles],
  )

  const hasPendingUploads = attachedFiles.some((attachment) => attachment.isUploading)
  const newChatToken = searchParams.get("new")
  const onboardingToken = searchParams.get("onboarding")

  React.useEffect(() => {
    if (typeof initialThreadId !== "string" || initialThreadId.length === 0) {
      return
    }

    setThreadId(initialThreadId)
    threadIdRef.current = initialThreadId
  }, [initialThreadId])

  React.useEffect(() => {
    if (!enablePersistence) {
      return
    }

    if (syncedInitialThreadIdRef.current === initialThreadId) {
      return
    }

    syncedInitialThreadIdRef.current = initialThreadId
    templateHandoffCompletedRef.current = false
    setMessages(initialMessages)
  }, [enablePersistence, initialMessages, initialThreadId, setMessages])

  React.useEffect(() => {
    const handleOpenSkillPicker = () => {
      setSkillLoadModalOpen(true)
    }

    window.addEventListener("chat-open-skill-picker", handleOpenSkillPicker)
    return () => {
      window.removeEventListener("chat-open-skill-picker", handleOpenSkillPicker)
    }
  }, [])

  React.useEffect(() => {
    if (!newChatToken) {
      return
    }

    setMessages([])
    setComposerValue("")
    setAttachedFiles([])
    setAttachedRefs([])
    setThreadId(undefined)
    threadIdRef.current = undefined
    persistBootstrapRef.current = null
    syncedInitialThreadIdRef.current = undefined
    onboardingBootstrapInFlightRef.current = false
    onboardingHandoffPendingRef.current = false
    onboardingBootstrapCompletedRef.current = false
    templateHandoffCompletedRef.current = false
    onThreadIdChange?.(undefined)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    router.replace("/chat")
  }, [newChatToken, onThreadIdChange, router, setMessages])

  React.useEffect(() => {
    onboardingBootstrapInFlightRef.current = false
    onboardingBootstrapCompletedRef.current = false
  }, [onboardingToken])

  React.useEffect(() => {
    if (!enablePersistence || !initialThreadId || !userId) return
    if (templateHandoffCompletedRef.current) return
    if (messages.length > 0) return
    if (status === "submitted" || status === "streaming") return
    if (isBootstrappingOnboarding || isCreatingThread) return

    const handoff = consumePendingTemplateHandoff(initialThreadId)
    if (!handoff) return

    templateHandoffCompletedRef.current = true
    threadIdRef.current = initialThreadId

    void sendMessage({
      role: handoff.openingMessage.role,
      parts: handoff.openingMessage.parts,
    })
  }, [
    enablePersistence,
    initialThreadId,
    isBootstrappingOnboarding,
    isCreatingThread,
    messages.length,
    sendMessage,
    status,
    userId,
  ])

  const handleAttachFiles = React.useCallback(async (files: File[]) => {
    if (files.length === 0) return
    if (!authReady) return
    if (!userId) {
      router.push(getLoginHref())
      return
    }

    const nextAttachments: ComposerUploadAttachment[] = files.map((file) => ({
      file,
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      isUploading: inferMediaTypeFromFile(file) !== "other",
      source: "upload",
    }))

    setAttachedFiles((prev) => [...prev, ...nextAttachments])

    await Promise.all(
      nextAttachments.map(async (attachment) => {
        if (!attachment.isUploading) {
          return
        }

        const result = await uploadFileToSupabase(attachment.file, "chat-user-uploads")

        setAttachedFiles((prev) =>
          prev.map((item) =>
            item.id === attachment.id
              ? {
                  ...item,
                  isUploading: false,
                  uploadedUrl: result?.url,
                }
              : item,
          ),
        )
      }),
    )
  }, [authReady, getLoginHref, router, userId])

  const handleAssetLibrarySelect = React.useCallback((pick: AssetSelectionPick) => {
    setAttachedRefs((prev) => [...prev, attachedRefFromDroppedMediaUrl(pick.url, pick.assetType)])
    setAssetModalOpen(false)
  }, [])

  const handleComposerDragEnter = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!authReady || !userId) return
    if (!composerDropTypesAccept(event.dataTransfer)) return
    event.preventDefault()
    setComposerDropActive(true)
  }, [authReady, userId])

  const handleComposerDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!authReady || !userId) return
    if (!composerDropTypesAccept(event.dataTransfer)) return
    const next = event.relatedTarget as Node | null
    if (next && event.currentTarget.contains(next)) return
    setComposerDropActive(false)
  }, [authReady, userId])

  const processComposerDrop = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setComposerDropActive(false)

      if (!authReady) return
      if (!userId) {
        router.push(getLoginHref())
        return
      }

      const rawNode = event.dataTransfer.getData(REACTFLOW_NODE_MIME)
      if (rawNode) {
        try {
          const parsed = JSON.parse(rawNode) as unknown
          const extracted = extractAssetFromNode(parsed)
          if (extracted) {
            setAttachedRefs((prev) => [...prev, attachedRefFromDroppedMediaUrl(extracted.url, extracted.type)])
            return
          }
        } catch {
          /* ignore malformed payload */
        }
      }

      const files = Array.from(event.dataTransfer.files ?? [])
      if (files.length > 0) {
        void handleAttachFiles(files)
      }
    },
    [authReady, getLoginHref, handleAttachFiles, router, userId],
  )

  const handleComposerDropCapture = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!authReady || !userId) return
      if (!composerDropTypesAccept(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()
      processComposerDrop(event)
    },
    [authReady, processComposerDrop, userId],
  )

  const handleComposerDragOverCapture = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!authReady || !userId) return
    if (!composerDropTypesAccept(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }, [authReady, userId])

  const removeAttachedRef = React.useCallback((ref: AttachedRef) => {
    setAttachedRefs((prev) => prev.filter((item) => item.chipId !== ref.chipId))
    setComposerValue((prev) => {
      if (!ref.mentionToken) {
        return prev
      }

      const start = prev.indexOf(ref.mentionToken)
      if (start === -1) {
        return prev
      }

      const end = extendMentionRangeEnd(prev, start, ref.mentionToken.length)
      return prev.slice(0, start) + prev.slice(end)
    })
  }, [])

  const focusChatComposer = React.useCallback(() => {
    requestAnimationFrame(() => {
      document.getElementById("chat-composer-textarea")?.focus()
    })
  }, [])

  const handleImageGridAgentAction = React.useCallback(
    (
      action: ImageGridAgentAction,
      image: {
        url: string
        prompt?: string | null
        model?: string | null
        aspectRatio?: string | null
        referenceImageUrls?: string[]
      },
    ) => {
      applyImageGridAgentAction({
        action,
        context: toImageGridAgentContext(image),
        setComposerValue,
        setAttachedRefs,
        focusComposer: focusChatComposer,
      })
      toast.message("Ready in prompt", {
        description: "Describe what you want and send.",
      })
    },
    [focusChatComposer],
  )

  const handleCreateAssetFromImage = React.useCallback((imageUrl: string, index: number) => {
    setSelectedImageForAsset({ url: imageUrl, index })
    setCreateAssetDialogOpen(true)
  }, [])

  const handleGenerationToolApprovalResponse = React.useCallback(
    async (part: GenerationApprovalActionPart, approved: boolean) => {
      if (!part.toolCallId) {
        toast.error("Could not find the generation request.")
        return
      }

      const previousMessages = messages
      const toastId = approved
        ? toast.loading("Starting generation...", {
            description: "Running the approved request now.",
          })
        : toast.message("Generation canceled.", {
            description: "No credits were spent.",
          })

      setMessages(markGenerationApprovalResponded(previousMessages, part.toolCallId, approved))

      try {
        const response = await fetch("/api/chat/generation-approval", {
          body: JSON.stringify({
            approved,
            messages: previousMessages,
            threadId: threadIdRef.current,
            toolCallId: part.toolCallId,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        })
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string
          messages?: UIMessage[]
        }

        if (!response.ok) {
          throw new Error(payload.error || "Could not update generation approval.")
        }

        if (Array.isArray(payload.messages)) {
          setMessages(payload.messages)
        }

        if (approved) {
          toast.success("Generation started.", {
            description: "The result card will update here.",
            id: toastId,
          })
        }
      } catch (approvalError) {
        setMessages(previousMessages)
        toast.error(
          approvalError instanceof Error
            ? approvalError.message
            : "Could not update generation approval.",
          {
            id: toastId,
          },
        )
      }
    },
    [messages, setMessages],
  )

  const transcribeAudioBlob = React.useCallback(async (audioBlob: Blob) => {
    const formData = new FormData()
    formData.append("audio", audioBlob, "audio.webm")

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    })

    const payload = (await response.json().catch(() => ({}))) as { error?: string; text?: string }

    if (!response.ok) {
      throw new Error(payload.error || "Transcription failed")
    }

    return typeof payload.text === "string" ? payload.text : ""
  }, [])

  const handleSpeechTranscription = React.useCallback((text: string) => {
    const next = text.trim()
    if (!next) return

    setComposerValue((prev) => {
      const p = prev.trimEnd()
      if (!p) return next
      return `${p} ${next}`
    })
  }, [])

  const handleSpeechError = React.useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : "Voice input failed"
    toast.error(message)
  }, [])

  const ensurePersistedThread = React.useCallback(
    async (title: string): Promise<string | undefined> => {
      let nextThreadId = threadId

      if (!enablePersistence) {
        if (nextThreadId) {
          threadIdRef.current = nextThreadId
        }
        return nextThreadId
      }

      if (nextThreadId) {
        threadIdRef.current = nextThreadId
        return nextThreadId
      }

      setIsCreatingThread(true)
      try {
        const response = await fetch("/api/chat/threads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        })

        if (!response.ok) {
          throw new Error("Failed to create chat thread.")
        }

        const data = await response.json()
        nextThreadId = data.thread?.id

        if (!nextThreadId) {
          throw new Error("Chat thread ID was missing from the response.")
        }

        threadIdRef.current = nextThreadId
        setThreadId(nextThreadId)
        onThreadIdChange?.(nextThreadId)
        storeChatBootstrapId(nextThreadId, resolvedUiChatBootstrapId)

        if (
          syncUrlOnThreadCreate &&
          typeof window !== "undefined" &&
          window.location.pathname !== `/chat/${nextThreadId}`
        ) {
          window.history.replaceState(window.history.state, "", `/chat/${nextThreadId}`)
        }

        return nextThreadId
      } finally {
        setIsCreatingThread(false)
      }
    },
    [enablePersistence, onThreadIdChange, resolvedUiChatBootstrapId, syncUrlOnThreadCreate, threadId],
  )

  React.useEffect(() => {
    if (!authReady) return
    if (newChatToken) return
    if (dashboardHandoffConsumedRef.current) return
    if (messages.length > 0) return
    if (status === "submitted" || status === "streaming") return
    if (hasPendingUploads || isCreatingThread || isBootstrappingOnboarding) return

    const handoff = consumeDashboardAgentHandoff()
    dashboardHandoffConsumedRef.current = true
    if (!handoff) return

    chatGatewayModelRef.current = handoff.model
    setChatGatewayModelId(handoff.model)

    if (!userId) {
      setComposerValue(handoff.prompt)
      setAttachedRefs(handoff.attachedRefs)
      return
    }

    const bootstrap = async () => {
      try {
        const title = handoff.prompt.trim() || handoff.attachedRefs[0]?.label || "New Chat"
        const nextThreadId = await ensurePersistedThread(title)
        if (nextThreadId) {
          threadIdRef.current = nextThreadId
        }

        await sendMessage({
          metadata: refsToChatMetadata(handoff.attachedRefs),
          role: "user",
          parts: [{ type: "text", text: handoff.prompt.trim() }],
        })
      } catch (error) {
        setComposerValue(handoff.prompt)
        setAttachedRefs(handoff.attachedRefs)
        toast.error(error instanceof Error ? error.message : "Could not start chat.")
      }
    }

    void bootstrap()
  }, [
    authReady,
    ensurePersistedThread,
    hasPendingUploads,
    isBootstrappingOnboarding,
    isCreatingThread,
    messages.length,
    newChatToken,
    sendMessage,
    status,
    userId,
  ])

  React.useEffect(() => {
    if (onboardingToken !== "1") {
      return
    }
    if (!enablePersistence || !authReady || !userId) {
      return
    }
    if (initialThreadId || threadIdRef.current || messages.length > 0) {
      return
    }
    if (
      hasPendingUploads ||
      isCreatingThread ||
      isBootstrappingOnboarding ||
      onboardingBootstrapInFlightRef.current ||
      onboardingBootstrapCompletedRef.current ||
      status === "submitted" ||
      status === "streaming"
    ) {
      return
    }

    onboardingBootstrapInFlightRef.current = true
    setIsBootstrappingOnboarding(true)

    const bootstrap = async () => {
      try {
        const nextThreadId = await ensurePersistedThread("Getting Started")
        if (!nextThreadId) {
          return
        }

        threadIdRef.current = nextThreadId
        onboardingHandoffPendingRef.current = true
        onboardingBootstrapCompletedRef.current = true

        sendMessage({
          role: "user",
          parts: [{ type: "text", text: ONBOARDING_HANDOFF_PROMPT }],
        })

        const url = new URL(window.location.href)
        url.searchParams.delete("onboarding")
        const nextUrl = `${url.pathname}${url.search}${url.hash}`
        window.history.replaceState(window.history.state, "", nextUrl)
      } catch (bootstrapError) {
        onboardingBootstrapCompletedRef.current = true
        onboardingHandoffPendingRef.current = false
        const url = new URL(window.location.href)
        url.searchParams.delete("onboarding")
        const nextUrl = `${url.pathname}${url.search}${url.hash}`
        window.history.replaceState(window.history.state, "", nextUrl)
        toast.error(
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Could not start your onboarding chat.",
        )
      } finally {
        onboardingBootstrapInFlightRef.current = false
        setIsBootstrappingOnboarding(false)
      }
    }

    void bootstrap()
  }, [
    authReady,
    enablePersistence,
    ensurePersistedThread,
    hasPendingUploads,
    initialThreadId,
    isBootstrappingOnboarding,
    isCreatingThread,
    messages.length,
    onboardingToken,
    sendMessage,
    status,
    userId,
  ])

  const handleSendMessage = React.useCallback(async () => {
    if (!authReady) return
    if (!userId) {
      router.push(getLoginHref())
      return
    }
    if (!composerValue.trim() && composerAttachments.length === 0) return
    if (hasPendingUploads) return
    if (isCreatingThread) return
    if (isBootstrappingOnboarding) return

    const normalizedComposerValue = normalizeLeadingSkillSlashPrompt(
      composerValue,
      availableSkills.map((skill) => skill.slug),
    )

    const parts: UIMessage["parts"] = []
    if (normalizedComposerValue) {
      parts.push({ type: "text", text: normalizedComposerValue })
    }
    parts.push(...(await filesToMessageParts(composerAttachments)))

    const title =
      composerValue.trim() ||
      (composerAttachments[0]?.source === "upload"
        ? composerAttachments[0].file.name
        : composerAttachments[0]?.title) ||
      attachedRefs[0]?.label ||
      "New Chat"

    const nextThreadId = await ensurePersistedThread(title)

    if (nextThreadId) {
      threadIdRef.current = nextThreadId
    }

    const draftComposerValue = composerValue
    const draftAttachedFiles = attachedFiles
    const draftAttachedRefs = attachedRefs

    setComposerValue("")
    setAttachedFiles([])
    setAttachedRefs([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    const userMessage = {
      metadata: refsToChatMetadata(attachedRefs),
      role: "user" as const,
      parts,
    }

    try {
      if (pendingGenerationApprovalIds.length > 0) {
        const canceled = cancelPendingGenerationApprovals(messages)
        queuedComposerSendRef.current = {
          message: userMessage,
          restoreAttachedFiles: draftAttachedFiles,
          restoreAttachedRefs: draftAttachedRefs,
          restoreComposerValue: draftComposerValue,
        }
        setMessages(canceled.messages)

        toast.message(
          canceled.canceledCount === 1
            ? "Canceled pending generation."
            : `Canceled ${canceled.canceledCount} pending generations.`,
          {
            description: "Sending your new message now.",
          },
        )
        return
      }

      await sendMessage(userMessage)
    } catch (sendError) {
      queuedComposerSendRef.current = null
      forceFullMessagesNextSendRef.current = false
      setComposerValue(draftComposerValue)
      setAttachedFiles(draftAttachedFiles)
      setAttachedRefs(draftAttachedRefs)
      toast.error(sendError instanceof Error ? sendError.message : "Could not send message.")
    }
  }, [
    availableSkills,
    attachedFiles,
    attachedRefs,
    authReady,
    composerAttachments,
    composerValue,
    ensurePersistedThread,
    hasPendingUploads,
    isBootstrappingOnboarding,
    isCreatingThread,
    getLoginHref,
    messages,
    pendingGenerationApprovalIds,
    router,
    sendMessage,
    setMessages,
    userId,
  ])

  const handleRequestSkillLoad = React.useCallback(
    async (slug: string) => {
      if (!userId) {
        router.push(getLoginHref())
        return
      }
      if (hasPendingUploads) {
        toast.message("Wait for uploads to finish.")
        return
      }
      if (isCreatingThread || isBootstrappingOnboarding) {
        return
      }
      if (status === "submitted" || status === "streaming") {
        toast.message("Wait for the current reply to finish.")
        return
      }

      const text = buildActivateSkillPrompt([slug])

      try {
        const nextThreadId = await ensurePersistedThread(`Skill: ${slug}`)
        if (nextThreadId) {
          threadIdRef.current = nextThreadId
        }

        sendMessage({
          role: "user",
          parts: [{ type: "text", text }],
        })
      } catch (loadError) {
        toast.error(loadError instanceof Error ? loadError.message : "Could not start chat.")
        throw loadError
      }
    },
    [
      ensurePersistedThread,
      hasPendingUploads,
      isBootstrappingOnboarding,
      isCreatingThread,
      getLoginHref,
      router,
      sendMessage,
      status,
      userId,
    ],
  )

  const handleUnpinSkill = React.useCallback(
    async (slug: string) => {
      if (!userId) {
        router.push(getLoginHref())
        return
      }

      try {
        const response = await fetch(`/api/skills/pins/${slug}`, {
          method: "DELETE",
          credentials: "same-origin",
        })
        const data = (await response.json().catch(() => ({}))) as {
          error?: string
          pinnedSkills?: PinnedSkillSummary[]
        }

        if (!response.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Could not unpin skill.")
        }

        setPinnedSkills(Array.isArray(data.pinnedSkills) ? data.pinnedSkills : [])
        toast.success("Skill unpinned.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not unpin skill.")
      }
    },
    [getLoginHref, router, userId],
  )

  const clearChat = React.useCallback(() => {
    const shouldNavigateToDraft = enablePersistence && Boolean(threadId)

    if (threadId) {
      clearStoredChatBootstrapId(threadId)
    }

    persistBootstrapRef.current = null
    syncedInitialThreadIdRef.current = undefined

    setMessages([])
    setComposerValue("")
    setAttachedFiles([])
    setAttachedRefs([])
    setThreadId(undefined)
    threadIdRef.current = undefined
    onThreadIdChange?.(undefined)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    if (shouldNavigateToDraft) {
      router.push("/chat")
    }
  }, [enablePersistence, onThreadIdChange, router, setMessages, threadId])

  const showEmptyState = messages.length === 0

  /**
   * Extra row below messages: only when there is no assistant placeholder yet (`submitted`),
   * or streaming before an assistant message exists (rare). Once the SDK appends the
   * assistant message, that row owns the avatar â€” a second row would duplicate it.
   */
  const showSubmittedLoading = React.useMemo(() => {
    if (messages.length === 0) return false
    if (status !== "submitted" && status !== "streaming") return false

    let lastUserIndex = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") {
        lastUserIndex = i
        break
      }
    }

    for (let i = lastUserIndex + 1; i < messages.length; i++) {
      const m = messages[i]
      if (m?.role !== "assistant") continue
      const assistantParts = m.parts ?? []
      const hasAnswerText = assistantParts.some(
        (part) => part.type === "text" && typeof part.text === "string" && part.text.trim().length > 0,
      )
      if (hasAnswerText) return false
      return false
    }

    return status === "submitted" || status === "streaming"
  }, [messages, status])

  return (
    <div
      className={cn(
        "flex flex-col",
        compact
          ? "h-full min-h-0 bg-transparent pt-0"
          : "h-dvh min-h-0 overflow-hidden bg-background pt-16 md:pt-20 px-0 lg:px-4",
      )}
    >
      {compact && mobileThreads !== undefined ? (
        <div className="flex shrink-0 items-center justify-start gap-2 bg-background/95 px-3 py-2 backdrop-blur md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="shrink-0 shadow-depth-l"
                aria-label="Chat history"
              >
                <ClockCounterClockwise className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[min(100vw-2rem,20rem)] max-h-[min(70vh,24rem)] overflow-y-auto">
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                Chat history
              </DropdownMenuLabel>
              {mobileThreads.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  No threads yet. Start a conversation to build your history.
                </div>
              ) : (
                mobileThreads.map((thread) => {
                  const isActive = threadId === thread.id
                  return (
                    <DropdownMenuItem key={thread.id} asChild>
                      <Link
                        href={`/chat/${thread.id}`}
                        className={cn(
                          "flex cursor-pointer flex-col items-start gap-0.5 py-2",
                          isActive && "bg-accent/50",
                        )}
                      >
                        <span className="flex w-full flex-wrap items-center gap-1.5 text-left">
                          <span className="line-clamp-2 flex-1 text-sm font-medium">{thread.title}</span>
                          {thread.source === "automation" ? (
                            <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                              Automation
                            </span>
                          ) : null}
                          {thread.source === "automation" && thread.automation_trigger === "manual" ? (
                            <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium">
                              Manual
                            </span>
                          ) : null}
                          {thread.source === "automation" && thread.automation_trigger === "scheduled" ? (
                            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                              Scheduled
                            </span>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatThreadUpdatedAt(thread.updated_at)}
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  )
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="shrink-0 shadow-depth-l"
            aria-label="New chat"
            onClick={clearChat}
          >
            <NotePencil className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          "mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col",
          compact ? "h-full" : "",
        )}
      >
        {!compact ? (
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/30">
                  <Image
                    src="/logo.svg"
                    alt="Website AI"
                    width={12}
                    height={12}
                    className="dark:invert"
                  />
                </span>
                <p className="truncate text-sm font-semibold">Chat</p>
              </div>
              <p className="text-xs text-muted-foreground">
                General creative chat
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={clearChat}>
              <NotePencil className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </div>
        ) : null}

        <Conversation className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <ConversationContent
            className={
              messages.length === 0
                ? "flex min-h-full flex-col items-center justify-center gap-6 px-4 py-6 text-center"
                : "mx-auto w-full max-w-4xl px-4 py-6"
            }
          >
            {showEmptyState ? (
              <div className="flex w-full max-w-2xl flex-col items-center gap-2">
                <ConversationEmptyState
                  className="pb-0"
                  icon={(
                    <span
                      className={cn(
                        "flex size-12 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/30",
                        !authReady && "animate-pulse",
                      )}
                    >
                      <Image
                        src="/logo.svg"
                        alt="Website AI"
                        width={22}
                        height={22}
                        className="dark:invert"
                      />
                    </span>
                  )}
                  title={EMPTY_STATE_TITLE}
                  description={EMPTY_STATE_DESCRIPTION}
                />
                <Suggestions className="justify-center">
                  {STARTER_PROMPTS.map((item) => (
                    <Suggestion
                      key={item.prompt}
                      suggestion={item.prompt}
                      title={item.prompt}
                      onClick={(value) => setComposerValue(value)}
                    >
                      {item.label}
                    </Suggestion>
                  ))}
                </Suggestions>
              </div>
            ) : null}

            {messages.map((message) => {
              const isUserMessage = message.role === "user"
              const isLastMessage = message.id === messages.at(-1)?.id
              const messageParts = message.parts ?? []
              const showEmptyAssistantThinking =
                !isUserMessage &&
                isLastMessage &&
                messageParts.length === 0 &&
                (status === "submitted" || status === "streaming")

              return (
                <Message
                  key={message.id}
                  from={isUserMessage ? "user" : "assistant"}
                  className={cn(!isUserMessage && "mb-2")}
                >
                  {isUserMessage ? (
                    <div className="flex w-full max-w-[85%] flex-col items-end gap-2">
                      {messageParts.some((part) => part.type === "text") ? (
                        <MessageContent className="max-w-full rounded-[24px] px-4 py-3 shadow-sm">
                          <UserMessageTextParts message={message} />
                        </MessageContent>
                      ) : null}
                      <UserMessageMediaParts message={message} />
                    </div>
                  ) : (
                    <div className="flex w-full min-w-0 max-w-3xl items-start gap-3">
                      <span className="mt-1 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/40">
                        <Image
                          src="/logo.svg"
                          alt="Website AI"
                          width={16}
                          height={16}
                          className="dark:invert"
                        />
                      </span>
                      <div className="min-w-0 flex-1 space-y-3 text-left text-[15px] leading-7 text-foreground">
                        <MessageParts
                          message={message}
                          allMessages={messages}
                          instagramConnectionsById={instagramConnectionsById}
                          socialConnectionsById={socialConnectionsById}
                          onEditSkillRequest={(slug) => setSkillEditModalSlug(slug)}
                          onToolApprovalResponse={(approvalId, approved) => {
                            void addToolApprovalResponse({
                              id: approvalId,
                              approved,
                            })
                          }}
                          onGenerationToolApprovalResponse={(part, approved) => {
                            void handleGenerationToolApprovalResponse(part, approved)
                          }}
                          onImageGridAgentAction={handleImageGridAgentAction}
                          onCreateAssetFromImage={handleCreateAssetFromImage}
                        />
                        {showEmptyAssistantThinking ? (
                          <div className="text-sm text-foreground">
                            <Shimmer className="leading-none">Thinking...</Shimmer>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </Message>
              )
            })}

            {showSubmittedLoading ? (
              <Message from="assistant" className="mb-2">
                <div className="flex w-full min-w-0 max-w-3xl items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/40">
                    <Image
                      src="/logo.svg"
                      alt="Website AI"
                      width={16}
                      height={16}
                      className="dark:invert"
                    />
                  </span>
                  <div className="min-w-0 flex-1 text-left text-sm text-foreground">
                    <Shimmer className="leading-none">Thinking...</Shimmer>
                  </div>
                </div>
              </Message>
            ) : null}

            {error ? (
              <Card className="w-full border-destructive/30 bg-destructive/5">
                <CardContent className="p-4 text-sm text-destructive">
                  {error.message || "Chat failed. Please try again."}
                </CardContent>
              </Card>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="z-10 shrink-0 bg-transparent px-0 pb-5 pt-3 sm:px-4">
          <div className="mx-auto w-full max-w-4xl space-y-3">
            {composerAttachments.length > 0 || attachedRefs.some((ref) => ref.category === "brand") ? (
              <div className="flex flex-wrap items-start gap-2">
                {composerAttachments.length > 0 ? (
                  <ComposerAttachmentPreviews
                    attachments={composerAttachments}
                    onRemove={(attachment) => {
                      if (attachment.source === "upload") {
                        setAttachedFiles((prev) => prev.filter((item) => item.id !== attachment.id))
                        return
                      }

                      removeAttachedRef(attachment.ref)
                    }}
                  />
                ) : null}

                <ChatBrandPills
                  refs={brandReferencesOnly(
                    attachedRefs.map((ref) => ({
                      assetType: ref.assetType,
                      assetUrl: ref.assetUrl,
                      category: ref.category,
                      id: ref.id,
                      label: ref.label,
                      previewUrl: ref.previewUrl,
                    })),
                  )}
                  onRemove={(id) => {
                    const ref = attachedRefs.find((item) => item.id === id)
                    if (ref) {
                      removeAttachedRef(ref)
                    }
                  }}
                />
              </div>
            ) : null}

            {pinnedSkills.length > 0 ? (
              <PinnedSkillPills
                skills={pinnedSkills}
                onRemove={
                  status === "submitted" || status === "streaming"
                    ? undefined
                    : (slug) => {
                        void handleUnpinSkill(slug)
                      }
                }
              />
            ) : null}

            <>
              <div
                className={cn(
                  "rounded-[26px] p-1 transition-[box-shadow,ring-color] sm:p-2",
                  composerDropActive && "ring-2 ring-primary/50 ring-offset-2 ring-offset-transparent",
                )}
                onDragEnter={handleComposerDragEnter}
                onDragLeave={handleComposerDragLeave}
                onDragOverCapture={handleComposerDragOverCapture}
                onDropCapture={handleComposerDropCapture}
              >
                <InputGroup className="composer-depth items-end rounded-[22px] border-black/10 dark:border-border/60 bg-background/95 p-1 backdrop-blur-sm has-[textarea]:rounded-[22px]">
                  <CommandTextarea
                    textareaId="chat-composer-textarea"
                    value={composerValue}
                    onChange={setComposerValue}
                    refs={attachedRefs}
                    onRefsChange={setAttachedRefs}
                    rows={3}
                    className="min-h-[72px] max-h-[180px] flex-1 px-3 py-2"
                    placeholder="Describe what you want. Type /skill-name to load a skill, @ for brands & assets."
                    slashCommands={chatSlashCommands}
                    slashCommandsContext="Skills"
                    onPasteImage={(file) => void handleAttachFiles([file])}
                    onPromptKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        void handleSendMessage()
                      }
                    }}
                  />
                  <InputGroupAddon align="block-end" className="gap-2 justify-between">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? [])
                        void handleAttachFiles(files)
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ""
                        }
                      }}
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Attach files or assets"
                            disabled={
                              !authReady ||
                              !userId ||
                              isCreatingThread ||
                              isBootstrappingOnboarding ||
                              status === "submitted" ||
                              status === "streaming"
                            }
                          >
                            <Plus className="h-4 w-4" />
                            <span className="sr-only">Attach</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="top" sideOffset={4}>
                          <DropdownMenuItem
                            onClick={() => fileInputRef.current?.click()}
                            disabled={
                              !authReady ||
                              !userId ||
                              isCreatingThread ||
                              isBootstrappingOnboarding ||
                              status === "submitted" ||
                              status === "streaming"
                            }
                          >
                            <FilePlus className="mr-2 size-4" />
                            Upload files
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setAssetModalOpen(true)}
                            disabled={
                              !authReady ||
                              !userId ||
                              isCreatingThread ||
                              isBootstrappingOnboarding ||
                              status === "submitted" ||
                              status === "streaming"
                            }
                          >
                            <FolderOpen className="mr-2 size-4" />
                            Select asset
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Select
                        value={chatGatewayModelId}
                        onValueChange={(value) => {
                          chatGatewayModelRef.current = value
                          setChatGatewayModelId(value)
                        }}
                        disabled={
                          !authReady ||
                          isCreatingThread ||
                          isBootstrappingOnboarding ||
                          status === "submitted" ||
                          status === "streaming"
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          aria-label="Chat model"
                          className="h-9 w-fit min-w-0 max-w-[min(100%,16rem)] shrink border-border/50 bg-background/40 px-2.5 hover:bg-background/60"
                        >
                          <SelectValue placeholder="Model">
                            <div className="flex min-w-0 items-center gap-2">
                              <ModelIcon
                                identifier={selectedChatGatewayOption.id}
                                size={16}
                                srcOverride={selectedChatGatewayOption.iconPath}
                              />
                              <span className="truncate">{selectedChatGatewayOption.label}</span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent align="start" position="popper" sideOffset={4} className="w-[min(calc(100vw-2rem),22rem)]">
                          {CHAT_GATEWAY_MODEL_OPTIONS.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                                <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
                                  <ModelIcon identifier={option.id} size={20} srcOverride={option.iconPath} />
                                </div>
                                <div className="flex min-w-0 flex-col gap-0.5">
                                  <span className="text-sm font-semibold">{option.label}</span>
                                  {option.description ? (
                                    <span className="text-xs text-muted-foreground">{option.description}</span>
                                  ) : null}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 shrink-0 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                            aria-label={`Skills loaded in this chat: ${loadedSkillsCount}. Open skill picker.`}
                            disabled={
                              !authReady ||
                              !userId ||
                              isCreatingThread ||
                              isBootstrappingOnboarding ||
                              status === "submitted" ||
                              status === "streaming"
                            }
                            onClick={() => setSkillLoadModalOpen(true)}
                          >
                            <Books className="size-4" weight="duotone" />
                            <Badge
                              variant="secondary"
                              className="h-5 min-w-5 rounded-full px-1.5 text-[10px] font-medium tabular-nums"
                            >
                              {loadedSkillsCount}
                            </Badge>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-56">
                          Unique skills successfully loaded in this chat (via activateSkill). Click to ask the
                          agent to load one.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 max-w-[14rem] shrink min-w-0 gap-1.5 rounded-full px-2 text-xs font-medium text-muted-foreground hover:text-foreground sm:px-3"
                            aria-label={
                              generationApprovalMode === "ask"
                                ? "Ask before generation"
                                : "Auto-run generation without asking"
                            }
                            disabled={
                              !authReady ||
                              isCreatingThread ||
                              isBootstrappingOnboarding ||
                              status === "submitted" ||
                              status === "streaming"
                            }
                          >
                            {generationApprovalMode === "ask" ? (
                              <HandPalm className="size-4 shrink-0" weight="duotone" />
                            ) : (
                              <Lightning className="size-4 shrink-0" weight="duotone" />
                            )}
                            <span className="hidden truncate md:inline">
                              {generationApprovalMode === "ask"
                                ? "Ask before generation"
                                : "Auto-run generation"}
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="top" sideOffset={4} className="w-64">
                          <DropdownMenuLabel className="font-normal text-muted-foreground">
                            Generation approval
                          </DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => updateGenerationApprovalMode("auto")}
                            className="gap-3"
                          >
                            <Lightning className="size-4 text-muted-foreground" weight="duotone" />
                            <span className="min-w-0 flex-1">Auto-run without asking</span>
                            {generationApprovalMode === "auto" ? <Check className="size-4" /> : null}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateGenerationApprovalMode("ask")}
                            className="gap-3"
                          >
                            <HandPalm className="size-4 text-muted-foreground" weight="duotone" />
                            <span className="min-w-0 flex-1">Confirm before running</span>
                            {generationApprovalMode === "ask" ? <Check className="size-4" /> : null}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <SpeechInput
                        forceServerTranscription
                        variant="ghost"
                        size="icon"
                        aria-label="Voice input"
                        onAudioRecorded={transcribeAudioBlob}
                        onTranscriptionChange={handleSpeechTranscription}
                        onTranscriptionError={handleSpeechError}
                        disabled={
                          !authReady ||
                          !userId ||
                          isCreatingThread ||
                          isBootstrappingOnboarding ||
                          status === "submitted" ||
                          status === "streaming"
                        }
                      />
                      <Button
                        type="button"
                        size="icon"
                        aria-label={
                          status === "submitted" || status === "streaming"
                            ? "Stop response"
                            : pendingGenerationApprovalIds.length > 0
                              ? "Cancel pending generation and send message"
                              : "Send message"
                        }
                        onClick={() => {
                          if (status === "submitted" || status === "streaming") {
                            stop()
                            return
                          }

                          void handleSendMessage()
                        }}
                        disabled={
                          !authReady ||
                          isCreatingThread ||
                          isBootstrappingOnboarding ||
                          hasPendingUploads ||
                          ((status !== "submitted" && status !== "streaming") &&
                            (!composerValue.trim() && composerAttachments.length === 0))
                        }
                      >
                        {isCreatingThread || hasPendingUploads ? (
                          <CircleNotch className="h-4 w-4 animate-spin" />
                        ) : status === "submitted" || status === "streaming" ? (
                          <X className="h-4 w-4" />
                        ) : (
                          <ArrowUp className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </InputGroupAddon>
                  </InputGroup>
                </div>
                {!userId && authReady ? (
                  <p className="px-1 text-xs text-muted-foreground">
                    You can draft a message now. Sending it will open login or signup first.
                  </p>
                ) : null}
                <AssetSelectionModal
                  open={assetModalOpen}
                  onOpenChange={setAssetModalOpen}
                  onSelect={handleAssetLibrarySelect}
                />
                <SkillLoadModal
                  open={skillLoadModalOpen}
                  onOpenChange={setSkillLoadModalOpen}
                  onRequestLoad={handleRequestSkillLoad}
                  onBuildWithAI={() => {
                    setSkillLoadModalOpen(false)
                    setComposerValue(
                      "Build me a new skill. Ask me what it should do, what situations trigger it, and what to call it â€” then create it for me.",
                    )
                  }}
                  onPinnedSkillsChange={refreshPinnedSkills}
                  disabled={
                    isCreatingThread ||
                    isBootstrappingOnboarding ||
                    hasPendingUploads ||
                    status === "submitted" ||
                    status === "streaming"
                  }
                />
                <SkillEditModal
                  open={Boolean(skillEditModalSlug)}
                  onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                    setSkillEditModalSlug(null)
                  }
                }}
                slug={skillEditModalSlug}
                />
                {selectedImageForAsset ? (
                  <CreateAssetDialog
                    open={createAssetDialogOpen}
                    onOpenChange={(open) => {
                      setCreateAssetDialogOpen(open)
                      if (!open) {
                        setSelectedImageForAsset(null)
                      }
                    }}
                    initial={{
                      title: `Generated Image ${selectedImageForAsset.index + 1}`,
                      url: selectedImageForAsset.url,
                      assetType: "image",
                    }}
                    onSaved={() => {
                      setSelectedImageForAsset(null)
                    }}
                  />
                ) : null}
            </>
          </div>
        </div>
      </div>
    </div>
  )
}

export { MessageParts } from "@/components/chat/message-parts"
export type { InstagramConnectionToolSummary } from "@/lib/chat/agent-tool-part-types"
