"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Plus } from "@phosphor-icons/react"
import { Conversation, ConversationContent, ConversationEmptyState } from "@/components/ai-elements/conversation"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group"
import { CommandTextarea } from "@/components/commands/command-textarea"
import type { AttachedRef } from "@/lib/commands/types"
import { CHAT_AGENT_COMMANDS } from "@/lib/commands/presets-chat"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function MockChatHero({
  starterPrompts = [],
}: {
  starterPrompts?: { label: string; prompt: string }[]
}) {
  const router = useRouter()
  const [composerValue, setComposerValue] = React.useState("")
  const [attachedRefs, setAttachedRefs] = React.useState<AttachedRef[]>([])

  const handleSendMessage = () => {
    router.push("/login")
  }

  return (
    <div className="flex h-full w-full flex-col bg-background/50">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <Conversation className="flex-1">
          <ConversationContent
            className="flex min-h-full flex-col items-center justify-center gap-6 px-4 py-6 text-center"
          >
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-2">
              <ConversationEmptyState
                className="pb-0"
                icon={(
                  <span className="flex size-12 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/30">
                    <Image
                      src="/logo.svg"
                      alt="Website AI"
                      width={22}
                      height={22}
                      className="dark:invert"
                    />
                  </span>
                )}
                title="Start a conversation"
                description="Ask a question, attach references, brainstorm ideas, or talk through a creative direction."
              />
              <Suggestions className="justify-center">
                {starterPrompts.map((item) => (
                  <Suggestion
                    key={item.prompt}
                    suggestion={item.prompt}
                    title={item.prompt}
                    onClick={(value) => {
                      setComposerValue(value)
                      // Optionally we could redirect right away on suggestion click:
                      // handleSendMessage()
                    }}
                  >
                    {item.label}
                  </Suggestion>
                ))}
              </Suggestions>
            </div>
          </ConversationContent>
        </Conversation>

        <div className="pointer-events-none sticky bottom-0 z-10 w-full flex-none">
          <div className="pointer-events-auto mx-auto w-full max-w-4xl px-4 pb-4">
            <div className="rounded-[26px] p-2 transition-[box-shadow,ring-color]">
              <InputGroup className="items-end rounded-[22px] border-border/60 bg-background/95 p-1 shadow-2xl backdrop-blur-sm has-[textarea]:rounded-[22px]">
                <CommandTextarea
                  value={composerValue}
                  onChange={setComposerValue}
                  refs={attachedRefs}
                  onRefsChange={setAttachedRefs}
                  rows={3}
                  className="min-h-[72px] max-h-[180px] flex-1 px-3 py-2"
                  placeholder="Describe what you want. / for shortcuts, @ for brands & assets."
                  slashCommands={CHAT_AGENT_COMMANDS}
                  slashCommandsContext="Agent"
                  onPromptKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      handleSendMessage()
                    }
                  }}
                />
                <InputGroupAddon align="block-end" className="gap-2 justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Attach files or assets"
                      onClick={() => handleSendMessage()}
                    >
                      <Plus className="h-4 w-4" />
                      <span className="sr-only">Attach</span>
                    </Button>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="icon"
                      className="size-8 rounded-full"
                      onClick={() => handleSendMessage()}
                    >
                      <span className="sr-only">Send</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="size-4"
                      >
                        <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                      </svg>
                    </Button>
                  </div>
                </InputGroupAddon>
              </InputGroup>
              <div className="mt-2 text-center text-[10px] text-muted-foreground/60 md:text-xs">
                AI can make mistakes. Please verify important information.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
