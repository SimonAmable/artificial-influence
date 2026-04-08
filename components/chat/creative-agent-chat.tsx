"use client"

import * as React from "react"
import type { UIMessage } from "ai"
import { DefaultChatTransport } from "ai"
import { Chat, useChat } from "@ai-sdk/react"
import { ArrowUp, CircleNotch, NotePencil, X } from "@phosphor-icons/react"
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group"
import { cn } from "@/lib/utils"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"

const STARTER_PROMPTS = [
  "Help me write a better image prompt.",
  "What workflow should I use for this idea?",
  "Analyze this reference and tell me what stands out.",
  "Turn this rough concept into a polished creative brief.",
]

const IMAGE_FILENAME_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i
const VIDEO_FILENAME_EXT = /\.(mp4|webm|mov|m4v|mkv)$/i
const AUDIO_FILENAME_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)$/i

type MediaValueType = "image" | "video" | "audio" | "other"

function inferMediaTypeFromFile(file: File): MediaValueType {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("audio/")) return "audio"
  const lower = file.name.toLowerCase()
  if (IMAGE_FILENAME_EXT.test(lower)) return "image"
  if (VIDEO_FILENAME_EXT.test(lower)) return "video"
  if (AUDIO_FILENAME_EXT.test(lower)) return "audio"
  return "other"
}

function useAttachmentObjectUrls(files: File[]) {
  const [urls, setUrls] = React.useState<string[]>([])

  React.useLayoutEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file))
    setUrls(next)
    return () => {
      next.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [files])

  return urls
}

const COMPOSER_THUMB_BOX =
  "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40"
const COMPOSER_THUMB_MEDIA = "h-full w-full object-cover"

function ComposerAttachmentPreviews({
  files,
  onRemoveAt,
}: {
  files: File[]
  onRemoveAt: (index: number) => void
}) {
  const urls = useAttachmentObjectUrls(files)

  if (files.length === 0) return null

  return (
    <div className="flex flex-row flex-wrap items-start gap-2">
      {files.map((file, index) => {
        const url = urls[index]
        const mediaType = inferMediaTypeFromFile(file)

        return (
          <div key={`${file.name}-${file.size}-${index}`} className="relative shrink-0">
            {mediaType === "image" ? (
              <div className={COMPOSER_THUMB_BOX} title={file.name}>
                {url ? (
                  <img src={url} alt="" className={COMPOSER_THUMB_MEDIA} />
                ) : (
                  <div className="h-full w-full animate-pulse bg-muted" aria-hidden />
                )}
              </div>
            ) : mediaType === "video" ? (
              <div className={COMPOSER_THUMB_BOX} title={file.name}>
                {url ? (
                  <video
                    src={url}
                    muted
                    playsInline
                    className={COMPOSER_THUMB_MEDIA}
                    aria-label={file.name}
                  />
                ) : (
                  <div className="h-full w-full animate-pulse bg-muted" aria-hidden />
                )}
              </div>
            ) : mediaType === "audio" ? (
              <div
                className="relative flex h-16 w-[min(100%,200px)] min-w-[160px] max-w-[220px] shrink-0 items-center rounded-lg border border-border bg-muted/40 px-2 py-1"
                title={file.name}
              >
                {url ? (
                  <audio src={url} controls className="h-8 w-full" />
                ) : (
                  <div className="h-8 w-full animate-pulse rounded bg-muted" aria-hidden />
                )}
              </div>
            ) : (
              <Badge variant="outline" className="max-w-[200px] shrink-0 truncate" title={file.name}>
                {file.name}
              </Badge>
            )}
            <button
              type="button"
              onClick={() => onRemoveAt(index)}
              className="absolute -top-1.5 -right-1.5 z-10 rounded-full border border-border bg-background p-1 shadow-sm hover:bg-destructive hover:text-destructive-foreground"
              aria-label={`Remove ${file.name}`}
            >
              <X className="size-3" weight="bold" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

async function filesToMessageParts(files: File[] | undefined): Promise<UIMessage["parts"]> {
  if (!files || files.length === 0) return []

  const parts = await Promise.all(
    files.map(
      (file) =>
        new Promise<UIMessage["parts"][number]>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            resolve({
              type: "file",
              url: reader.result as string,
              mediaType: file.type,
              filename: file.name,
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        }),
    ),
  )

  return parts
}

function MessageParts({ message }: { message: UIMessage }) {
  return (
    <>
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
              <img
                key={`${message.id}-${index}`}
                src={part.url}
                alt={part.filename || "Attachment"}
                className="my-2 max-h-72 rounded-2xl border border-border/60 object-contain"
              />
            )
          }

          if (part.mediaType?.startsWith("video/")) {
            return (
              <video
                key={`${message.id}-${index}`}
                src={part.url}
                controls
                className="my-2 max-h-72 rounded-2xl border border-border/60 bg-black"
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
    </>
  )
}

export function CreativeAgentChat({
  initialProjectId,
  compact = false,
}: {
  initialThreadId?: string | null
  initialProjectId?: string | null
  compact?: boolean
}) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [authReady, setAuthReady] = React.useState(false)
  const [composerValue, setComposerValue] = React.useState("")
  const [attachedFiles, setAttachedFiles] = React.useState<File[]>([])

  const chat = React.useMemo(
    () =>
      new Chat({
        id: `creative-chat-${initialProjectId ?? "general"}`,
        transport: new DefaultChatTransport({
          api: "/api/chat",
        }),
      }),
    [initialProjectId],
  )

  const { messages, sendMessage, setMessages, status, error } = useChat({
    chat,
    experimental_throttle: 50,
  })

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

  const handleSendMessage = React.useCallback(async () => {
    if (!userId) return
    if (!composerValue.trim() && attachedFiles.length === 0) return

    const parts: UIMessage["parts"] = []
    if (composerValue.trim()) {
      parts.push({ type: "text", text: composerValue.trim() })
    }
    parts.push(...(await filesToMessageParts(attachedFiles)))

    sendMessage(
      {
        role: "user",
        parts,
      },
      {
        body: {
          mode: "chat",
        },
      },
    )

    setComposerValue("")
    setAttachedFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [attachedFiles, composerValue, sendMessage, userId])

  const clearChat = React.useCallback(() => {
    setMessages([])
    setComposerValue("")
    setAttachedFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [setMessages])

  return (
    <div
      className={cn(
        "bg-background",
        compact ? "h-full pt-0" : "pt-16 md:pt-20 px-0 lg:px-4",
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-5xl flex-col",
          compact ? "h-full min-h-0" : "min-h-[calc(100vh-5rem)]",
        )}
      >
        {!compact ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Chat</p>
              <p className="text-xs text-muted-foreground">
                {initialProjectId ? "Project-aware creative chat" : "General creative chat"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={clearChat}>
              <NotePencil className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </div>
        ) : null}

        <Conversation className="min-h-0 flex-1 overflow-y-auto">
          <ConversationContent
            className={
              messages.length === 0
                ? "flex min-h-full flex-col items-center justify-center gap-6 px-4 py-6 text-center"
                : "mx-auto w-full max-w-4xl px-4 py-6"
            }
          >
            {!authReady ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleNotch className="h-4 w-4 animate-spin" />
                Loading chat...
              </div>
            ) : null}

            {authReady && !userId ? (
              <Card className="w-full max-w-lg border-border/60 bg-muted/20">
                <CardContent className="space-y-4 p-6 text-center">
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">Log in to use chat</p>
                    <p className="text-sm text-muted-foreground">
                      Chat currently uses your authenticated session for model access.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Button asChild>
                      <a href="/login">Login</a>
                    </Button>
                    <Button asChild variant="outline">
                      <a href="/login?mode=signup">Signup</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {authReady && userId && messages.length === 0 ? (
              <>
                <ConversationEmptyState
                  title="Start a conversation"
                  description="Ask a question, attach references, brainstorm ideas, or talk through a creative direction."
                />
                <Suggestions className="max-w-2xl justify-center">
                  {STARTER_PROMPTS.map((prompt) => (
                    <Suggestion
                      key={prompt}
                      suggestion={prompt}
                      onClick={(value) => setComposerValue(value)}
                    >
                      {prompt}
                    </Suggestion>
                  ))}
                </Suggestions>
              </>
            ) : null}

            {messages.map((message) => {
              const isUserMessage = message.role === "user"

              return (
                <Message
                  key={message.id}
                  from={isUserMessage ? "user" : "assistant"}
                  className={cn(!isUserMessage && "mb-2")}
                >
                  {isUserMessage ? (
                    <MessageContent className="max-w-[85%] rounded-[24px] px-4 py-3 shadow-sm">
                      <MessageParts message={message} />
                    </MessageContent>
                  ) : (
                    <div className="w-full max-w-3xl space-y-3 text-left text-[15px] leading-7 text-foreground">
                      <MessageParts message={message} />
                    </div>
                  )}
                </Message>
              )
            })}

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

        <div className="z-10 px-4 pb-5 pt-3">
          <div className="mx-auto max-w-4xl space-y-3">
            {userId && attachedFiles.length > 0 ? (
              <ComposerAttachmentPreviews
                files={attachedFiles}
                onRemoveAt={(index) =>
                  setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
                }
              />
            ) : null}

            {userId ? (
              <div className="rounded-[26px] border border-border/60 bg-background/95 p-2 shadow-[0_24px_80px_-36px_rgba(0,0,0,0.8)] backdrop-blur">
                <InputGroup className="items-end">
                  <InputGroupTextarea
                    value={composerValue}
                    onChange={(event) => setComposerValue(event.target.value)}
                    rows={3}
                    placeholder="Describe the goal, attach references, or ask a question..."
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        void handleSendMessage()
                      }
                    }}
                  />
                  <InputGroupAddon align="block-end" className="gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? [])
                        if (files.length > 0) {
                          setAttachedFiles((prev) => [...prev, ...files])
                        }
                      }}
                    />
                    <InputGroupButton
                      type="button"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Attach
                    </InputGroupButton>
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => void handleSendMessage()}
                      disabled={
                        status === "submitted" ||
                        status === "streaming" ||
                        (!composerValue.trim() && attachedFiles.length === 0)
                      }
                    >
                      {status === "submitted" || status === "streaming" ? (
                        <CircleNotch className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUp className="h-4 w-4" />
                      )}
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
