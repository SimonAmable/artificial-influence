"use client"

import * as React from "react"
import { Chat, useChat, type UIMessage } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { motion, AnimatePresence } from "framer-motion"
import { X, ArrowUp, Plus, NotePencil, UploadSimple } from "@phosphor-icons/react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { UNICAN_ASSISTANT_NAME } from "@/lib/constants/system-prompts"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import { useProjectAgentChat } from "@/hooks/use-project-agent-chat"
import { EDITOR_RUNTIME_EVENT } from "@/lib/editor/runtime"
import type { EditorRuntimeContext } from "@/lib/editor/types"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { ToolExecutionList } from "@/components/ai-elements/tool-execution"

const CHAT_MODELS = [
  { identifier: "google/gemini-3-flash-preview", name: "Gemini 3 Flash" },
  { identifier: "xai/grok-4.1-fast-reasoning", name: "Grok 4.1 Fast" },
] as const

function formatChatModelName(identifier: string, name: string): string {
  if (name && !name.includes("/")) return name
  const parts = identifier.split("/")
  const short = parts[parts.length - 1]
  return short
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const generalChat = new Chat({
  transport: new DefaultChatTransport({
    api: "/api/chat",
  }),
})

interface AIChatProps {
  className?: string
}

export type ChatMode = "chat" | "prompt-recreate" | "agent"

const SUGGESTIONS_BY_MODE: Record<ChatMode, string[]> = {
  chat: [
    "How do I get started on the canvas?",
    "Which models are best for images?",
    "Fastest path from idea to export?",
  ],
  "prompt-recreate": [
    "What should I upload for best results?",
    "What does the JSON output include?",
    "Tips for matching lighting and color",
  ],
  agent: [
    "Add a text layer titled Hello",
    "Split the selected clip at the playhead",
    "Remove the selected items",
  ],
}

export function AIChat({ className }: AIChatProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [mode, setMode] = React.useState<ChatMode>("chat")
  const [model, setModel] = React.useState<string>(CHAT_MODELS[0].identifier)
  const [isDraggingOver, setIsDraggingOver] = React.useState(false)
  const [editorContext, setEditorContext] = React.useState<EditorRuntimeContext>({
    projectId: null,
    selectionItemIds: [],
    playheadFrame: 0,
    activeRoute: "other",
  })
  const dragCounter = React.useRef(0)
  const chatContainerRef = React.useRef<HTMLDivElement>(null)

  const { messages, sendMessage, setMessages, status: chatStatus } = useChat({
    chat: generalChat,
    experimental_throttle: 50,
  })
  const {
    messages: agentMessages,
    sendAgentMessage,
    clearAgentMessages,
    commandHistory,
    pendingAction,
    status: agentStatus,
  } = useProjectAgentChat({
    projectId: editorContext.projectId,
    selectionItemIds: editorContext.selectionItemIds,
    playheadFrame: editorContext.playheadFrame,
  })

  const activeMessages = mode === "agent" ? agentMessages : messages
  const agentAvailable = Boolean(editorContext.projectId)
  const streamStatus = mode === "agent" ? agentStatus : chatStatus
  const suggestionsIdle = streamStatus === "ready"

  const clearMessages = React.useCallback(() => {
    if (mode === "agent") {
      void clearAgentMessages()
      return
    }

    setMessages([])
  }, [clearAgentMessages, mode, setMessages])

  const handleSendMessage = React.useCallback(
    (
      message: {
        role: "user"
        parts: UIMessage["parts"]
      },
      selectedModel: string,
    ) => {
      if (mode === "agent") {
        sendAgentMessage(message, selectedModel)
        return
      }

      sendMessage(message, {
        body: {
          mode,
          model: selectedModel,
        },
      })
    },
    [mode, sendAgentMessage, sendMessage],
  )

  const handleSuggestionSend = React.useCallback(
    (text: string) => {
      void handleSendMessage({ role: "user", parts: [{ type: "text", text }] }, model)
    },
    [handleSendMessage, model],
  )

  React.useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true)
    }

    window.addEventListener("chat-open", handleOpenChat as EventListener)
    return () => {
      window.removeEventListener("chat-open", handleOpenChat as EventListener)
    }
  }, [])

  React.useEffect(() => {
    const handleRuntimeContext = (event: Event) => {
      const customEvent = event as CustomEvent<EditorRuntimeContext>
      setEditorContext(customEvent.detail)
    }

    window.addEventListener(EDITOR_RUNTIME_EVENT, handleRuntimeContext as EventListener)
    return () => {
      window.removeEventListener(EDITOR_RUNTIME_EVENT, handleRuntimeContext as EventListener)
    }
  }, [])

  React.useEffect(() => {
    if (
      editorContext.projectId &&
      (editorContext.activeRoute === "editor" || editorContext.activeRoute === "agent-chat")
    ) {
      setMode("agent")
      return
    }

    if (!editorContext.projectId && mode === "agent") {
      setMode("chat")
    }
  }, [editorContext.activeRoute, editorContext.projectId, mode])

  const handleDragOver = React.useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer.types.includes("Files")) {
      setIsDraggingOver(true)
    }
  }, [])

  const handleDragEnter = React.useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer.types.includes("Files")) {
      dragCounter.current += 1
      setIsDraggingOver(true)
    }
  }, [])

  const handleDragLeave = React.useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDraggingOver(false)
    }
  }, [])

  const handleDrop = React.useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    dragCounter.current = 0
    setIsDraggingOver(false)

    const nodeDataStr = event.dataTransfer.getData("application/reactflow-node")

    if (nodeDataStr) {
      try {
        const nodeData = JSON.parse(nodeDataStr)

        let assetUrl: string | null = null
        let assetType: "image" | "video" | "audio" | null = null

        if (nodeData.type === "upload" && nodeData.data?.fileUrl) {
          assetUrl = nodeData.data.fileUrl
          assetType = nodeData.data.fileType || "image"
        } else if (nodeData.type === "image-gen" && nodeData.data?.generatedImageUrl) {
          assetUrl = nodeData.data.generatedImageUrl
          assetType = "image"
        } else if (nodeData.type === "video-gen" && nodeData.data?.generatedVideoUrl) {
          assetUrl = nodeData.data.generatedVideoUrl
          assetType = "video"
        } else if (nodeData.type === "audio" && nodeData.data?.generatedAudioUrl) {
          assetUrl = nodeData.data.generatedAudioUrl
          assetType = "audio"
        }

        if (assetUrl && assetType) {
          window.dispatchEvent(
            new CustomEvent("chat-add-asset", {
              detail: { url: assetUrl, type: assetType },
            }),
          )
        }
      } catch (error) {
        console.error("Failed to parse node data:", error)
      }
    }

    const files = event.dataTransfer.files
    if (files && files.length > 0) {
      window.dispatchEvent(
        new CustomEvent("chat-add-files", {
          detail: { files },
        }),
      )
    }
  }, [])

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            aria-label={`Open ${UNICAN_ASSISTANT_NAME}`}
            className={cn(
              "fixed bottom-6 right-6 z-[60]",
              "flex h-14 w-14 items-center justify-center rounded-full",
              "bg-foreground shadow-lg transition-shadow hover:shadow-xl",
              className,
            )}
          >
            <Image
              src="/logo.svg"
              alt=""
              width={24}
              height={24}
              className="invert dark:invert-0"
            />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
            />

            <motion.div
              ref={chatContainerRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "fixed right-0 top-0 bottom-0 z-50",
                "flex w-full flex-col border-l border-border bg-background shadow-2xl md:w-[480px]",
              )}
            >
              <AnimatePresence>
                {isDraggingOver && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/95 backdrop-blur-sm"
                  >
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                      <UploadSimple className="h-12 w-12 text-primary" weight="bold" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-foreground">Drop to add attachment</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Images, videos, audio, or canvas nodes
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground">
                    <Image
                      src="/logo.svg"
                      alt=""
                      width={16}
                      height={16}
                      className="invert dark:invert-0"
                    />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold leading-tight">{UNICAN_ASSISTANT_NAME}</h2>
                    <p className="text-xs font-normal text-muted-foreground">
                      {mode === "agent"
                        ? agentAvailable
                          ? "Timeline agent"
                          : "Agent needs a project"
                        : mode === "prompt-recreate"
                          ? "Prompt recreate"
                          : "UniCan guide"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearMessages}
                    className="h-8 w-8"
                    title="Clear chat"
                  >
                    <NotePencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Conversation className="min-h-0 flex-1">
                <ConversationContent
                  className={
                    activeMessages.length === 0
                      ? "flex min-h-full flex-col items-center justify-center gap-6 p-4 text-center"
                      : undefined
                  }
                >
                  {activeMessages.length === 0 ? (
                    <>
                      <ConversationEmptyState
                        className="h-auto min-h-0 w-full max-w-sm shrink-0 text-muted-foreground"
                        icon={
                          <Image src="/logo.svg" alt="" width={64} height={64} className="dark:invert" />
                        }
                        title={
                          mode === "chat"
                            ? `Hi, I'm ${UNICAN_ASSISTANT_NAME}`
                            : mode === "prompt-recreate"
                              ? "Prompt Recreate"
                              : "Editor Agent"
                        }
                        description={
                          mode === "chat"
                            ? "Ask me about workflows, models, the canvas, or the fastest way to go from idea to finished content."
                            : mode === "prompt-recreate"
                              ? "Upload an image to decompose its visual elements and get a NanoBanana Pro JSON prompt to recreate it."
                              : agentAvailable
                                ? "Ask me to add text, split clips, remove items, move clips, change speed, or chain several actions together."
                                : "Open an editor project first to bind the agent to a timeline."
                        }
                      />
                      {suggestionsIdle && (mode !== "agent" || agentAvailable) ? (
                        <div className="flex w-full max-w-md flex-wrap justify-center gap-2">
                          {SUGGESTIONS_BY_MODE[mode].map((suggestion) => (
                            <Suggestion
                              key={suggestion}
                              suggestion={suggestion}
                              onClick={handleSuggestionSend}
                            />
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {mode === "agent" && pendingAction ? (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      Pending confirmation: {pendingAction.label}
                    </div>
                  ) : null}

                  {activeMessages.map((message) => {
                    const fromRole = message.role === "user" ? "user" : "assistant"
                    return (
                      <Message key={message.id} from={fromRole}>
                        {message.role === "assistant" ? (
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white">
                            <Image src="/logo.svg" alt="" width={16} height={16} />
                          </div>
                        ) : null}

                        <MessageContent>
                          {message.parts.map((part, index) => {
                            if (part.type === "text") {
                              return (
                                <MessageResponse key={`${message.id}-${index}`}>
                                  {part.text}
                                </MessageResponse>
                              )
                            }

                            if (part.type === "file") {
                              if (part.mediaType?.startsWith("image/")) {
                                return (
                                  <Image
                                    key={`${message.id}-${index}`}
                                    src={part.url}
                                    alt={part.filename || "attachment"}
                                    width={300}
                                    height={300}
                                    className="my-2 rounded-lg"
                                  />
                                )
                              }

                              if (part.mediaType?.startsWith("video/")) {
                                return (
                                  <video
                                    key={`${message.id}-${index}`}
                                    src={part.url}
                                    controls
                                    className="my-2 max-w-full rounded-lg"
                                  />
                                )
                              }

                              if (part.mediaType?.startsWith("audio/")) {
                                return (
                                  <audio
                                    key={`${message.id}-${index}`}
                                    src={part.url}
                                    controls
                                    className="my-2 w-full"
                                  />
                                )
                              }
                            }

                            return null
                          })}
                        </MessageContent>
                      </Message>
                    )
                  })}

                  {mode === "agent" && commandHistory.length > 0 ? (
                    <ToolExecutionList entries={commandHistory.slice(-3).reverse()} />
                  ) : null}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>

              {activeMessages.length > 0 &&
              suggestionsIdle &&
              (mode !== "agent" || agentAvailable) ? (
                <div className="shrink-0 border-t border-border/60 px-4 pb-2 pt-3">
                  <Suggestions className="pb-1">
                    {SUGGESTIONS_BY_MODE[mode].map((suggestion) => (
                      <Suggestion
                        key={suggestion}
                        suggestion={suggestion}
                        onClick={handleSuggestionSend}
                      />
                    ))}
                  </Suggestions>
                </div>
              ) : null}

              <MessageInput
                mode={mode}
                setMode={setMode}
                model={model}
                setModel={setModel}
                onSendMessage={handleSendMessage}
                agentAvailable={agentAvailable}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

interface MessageInputProps {
  mode: ChatMode
  setMode: (mode: ChatMode) => void
  model: string
  setModel: (model: string) => void
  onSendMessage: (
    message: {
      role: "user"
      parts: UIMessage["parts"]
    },
    model: string,
  ) => void | Promise<void>
  agentAvailable: boolean
}

function MessageInput({
  mode,
  setMode,
  model,
  setModel,
  onSendMessage,
  agentAvailable,
}: MessageInputProps) {
  const [input, setInput] = React.useState("")
  const [files, setFiles] = React.useState<FileList | undefined>(undefined)
  const [droppedAssets, setDroppedAssets] = React.useState<Array<{ url: string; type: string }>>(
    [],
  )
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const handleAddAsset = (event: CustomEvent<{ url: string; type: string }>) => {
      setDroppedAssets((current) => [...current, event.detail])
    }

    const handleAddFiles = (event: CustomEvent<{ files: FileList }>) => {
      setFiles(event.detail.files)
    }

    const handleAddText = (event: CustomEvent<{ text: string }>) => {
      setInput((current) => (current ? `${current}\n\n${event.detail.text}` : event.detail.text))
    }

    window.addEventListener("chat-add-asset", handleAddAsset as EventListener)
    window.addEventListener("chat-add-files", handleAddFiles as EventListener)
    window.addEventListener("chat-add-text", handleAddText as EventListener)

    return () => {
      window.removeEventListener("chat-add-asset", handleAddAsset as EventListener)
      window.removeEventListener("chat-add-files", handleAddFiles as EventListener)
      window.removeEventListener("chat-add-text", handleAddText as EventListener)
    }
  }, [])

  const convertFilesToDataURLs = async (fileList: FileList) => {
    return Promise.all(
      Array.from(fileList).map(
        (file) =>
          new Promise<{
            type: "file"
            mediaType: string
            url: string
          }>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              resolve({
                type: "file",
                mediaType: file.type,
                url: reader.result as string,
              })
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
          }),
      ),
    )
  }

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }

      if (imageFiles.length > 0) {
        event.preventDefault()
        const dataTransfer = new DataTransfer()
        imageFiles.forEach((file) => dataTransfer.items.add(file))
        if (files) {
          Array.from(files).forEach((file) => dataTransfer.items.add(file))
        }
        setFiles(dataTransfer.files)
      }
    },
    [files],
  )

  const submitCurrentMessage = React.useCallback(async () => {
    if (!input.trim() && !files && droppedAssets.length === 0) return
    if (mode === "agent" && !agentAvailable) return

    const fileParts =
      files && files.length > 0 ? await convertFilesToDataURLs(files) : []
    const assetParts = droppedAssets.map((asset) => ({
      type: "file" as const,
      mediaType: asset.type.includes("image")
        ? "image/png"
        : asset.type.includes("video")
          ? "video/mp4"
          : "audio/mp3",
      url: asset.url,
    }))

    await onSendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: input }, ...fileParts, ...assetParts],
      },
      model,
    )

    setInput("")
    setFiles(undefined)
    setDroppedAssets([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [agentAvailable, droppedAssets, files, input, mode, model, onSendMessage])

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      await submitCurrentMessage()
    },
    [submitCurrentMessage],
  )

  return (
    <div className="rounded-t-3xl p-4 shadow-lg">
      {((files && files.length > 0) || droppedAssets.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {droppedAssets.map((asset, index) => (
            <div key={`asset-${index}`} className="relative">
              {asset.type.includes("image") ? (
                <img
                  src={asset.url}
                  alt={`Canvas asset ${index + 1}`}
                  className="h-16 w-16 rounded object-cover"
                />
              ) : asset.type.includes("video") ? (
                <video src={asset.url} className="h-16 w-16 rounded object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  Audio
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setDroppedAssets((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-xs text-background"
              >
                x
              </button>
            </div>
          ))}

          {files &&
            Array.from(files).map((file, index) => (
              <div key={`file-${index}`} className="relative">
                {file.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-16 w-16 rounded object-cover"
                  />
                ) : file.type.startsWith("video/") ? (
                  <video src={URL.createObjectURL(file)} className="h-16 w-16 rounded object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded bg-muted px-2 text-center text-xs text-muted-foreground">
                    {file.name}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const dataTransfer = new DataTransfer()
                    Array.from(files)
                      .filter((_, fileIndex) => fileIndex !== index)
                      .forEach((nextFile) => dataTransfer.items.add(nextFile))
                    setFiles(dataTransfer.files.length > 0 ? dataTransfer.files : undefined)
                    if (fileInputRef.current) {
                      fileInputRef.current.files = dataTransfer.files
                    }
                  }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-xs text-background"
                >
                  x
                </button>
              </div>
            ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={(event) => {
            if (event.target.files) {
              setFiles(event.target.files)
            }
          }}
          accept="image/*,video/*,audio/*"
          multiple
          className="hidden"
        />
        <div className="flex flex-col gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onPaste={handlePaste}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void submitCurrentMessage()
              }
            }}
            placeholder={
              mode === "chat"
                ? "Say something..."
                : mode === "prompt-recreate"
                  ? "Upload an image or add instructions (e.g. make it warmer, emphasize X)..."
                  : agentAvailable
                    ? "Add text, split clips, move items, change speed, or remove the selected clip..."
                    : "Open an editor project first to use agent mode..."
            }
            rows={3}
            className="min-h-[4.5rem] w-full resize-y border-0 bg-transparent px-0 py-2 text-base focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Select value={mode} onValueChange={(value) => setMode(value as ChatMode)}>
                  <SelectTrigger size="sm" className="h-7 w-fit min-w-0 px-2 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="top" sideOffset={4}>
                    <SelectItem value="chat">Chat</SelectItem>
                    <SelectItem value="prompt-recreate">Prompt Recreate</SelectItem>
                    {agentAvailable ? <SelectItem value="agent">Agent</SelectItem> : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger size="sm" className="h-7 w-fit min-w-0 px-2 text-xs">
                    <SelectValue placeholder="Select model">
                      {model && (
                        <div className="flex items-center gap-2">
                          <ModelIcon identifier={model} size={16} />
                          <span>
                            {(() => {
                              const selectedModel = CHAT_MODELS.find((item) => item.identifier === model)
                              return selectedModel
                                ? formatChatModelName(selectedModel.identifier, selectedModel.name)
                                : formatChatModelName(model, "")
                            })()}
                          </span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent position="popper" side="top" sideOffset={4}>
                    {CHAT_MODELS.map((chatModel) => (
                      <SelectItem key={chatModel.identifier} value={chatModel.identifier}>
                        <div className="flex items-center gap-2">
                          <ModelIcon identifier={chatModel.identifier} size={16} />
                          <span>{formatChatModelName(chatModel.identifier, chatModel.name)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 w-9 shrink-0 opacity-60 hover:opacity-100"
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button
                type="submit"
                size="icon"
                disabled={(!input.trim() && !files && droppedAssets.length === 0) || (mode === "agent" && !agentAvailable)}
                className="h-9 w-9 shrink-0 bg-foreground text-background hover:bg-foreground/90"
              >
                <ArrowUp className="h-5 w-5 text-background" weight="bold" />
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
