"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Player } from "@remotion/player"
import { ArrowUp, NotePencil, SpinnerGap } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import { EditorComposition } from "@/components/editor/editor-composition"
import { fetchEditorProject, fetchEditorProjects } from "@/lib/editor/database"
import { dispatchEditorRuntimeContext } from "@/lib/editor/runtime"
import type { EditorProject, EditorProjectSummary } from "@/lib/editor/types"
import { formatFramesToDuration } from "@/lib/editor/utils"
import { useProjectAgentChat } from "@/hooks/use-project-agent-chat"

export function AgentChatWorkspace({
  projectId,
}: {
  projectId: string | null
}) {
  const router = useRouter()
  const [projects, setProjects] = React.useState<EditorProjectSummary[]>([])
  const [project, setProject] = React.useState<EditorProject | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [input, setInput] = React.useState("")
  const {
    messages,
    sendAgentMessage,
    clearAgentMessages,
    status,
  } = useProjectAgentChat({
    projectId,
    selectionItemIds: [],
    playheadFrame: 0,
  })

  React.useEffect(() => {
    void fetchEditorProjects()
      .then((nextProjects) => {
        setProjects(nextProjects)
        if (!projectId && nextProjects.length === 1) {
          router.replace(`/chat?projectId=${nextProjects[0].id}`)
        }
      })
      .catch(console.error)
  }, [projectId, router])

  React.useEffect(() => {
    if (!projectId) {
      setProject(null)
      setLoading(false)
      dispatchEditorRuntimeContext({
        projectId: null,
        selectionItemIds: [],
        playheadFrame: 0,
        activeRoute: "agent-chat",
      })
      return
    }

    setLoading(true)
    void fetchEditorProject(projectId)
      .then((nextProject) => {
        setProject(nextProject)
        dispatchEditorRuntimeContext({
          projectId: nextProject.id,
          selectionItemIds: [],
          playheadFrame: 0,
          activeRoute: "agent-chat",
        })
      })
      .finally(() => setLoading(false))

    return () => {
      dispatchEditorRuntimeContext({
        projectId: null,
        selectionItemIds: [],
        playheadFrame: 0,
        activeRoute: "other",
      })
    }
  }, [projectId])

  const handleSubmit = React.useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      if (!input.trim() || !projectId) return

      sendAgentMessage({
        role: "user",
        parts: [{ type: "text", text: input }],
      })
      setInput("")
    },
    [input, projectId, sendAgentMessage],
  )

  return (
    <div className="min-h-screen bg-background px-4 pb-8 pt-24 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Project Picker</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No editor projects yet. Create one first, then return here.
                </p>
                <Button asChild className="w-full">
                  <Link href="/editor">Go to projects</Link>
                </Button>
              </div>
            ) : (
              projects.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(`/chat?projectId=${item.id}`)}
                  className={`w-full rounded-lg border p-3 text-left ${
                    item.id === projectId ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFramesToDuration(
                      item.duration_in_frames,
                      item.composition_settings.fps,
                    )}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="min-h-[70vh]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Project Chat</CardTitle>
              <Button variant="outline" size="sm" onClick={() => void clearAgentMessages()}>
                <NotePencil className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </CardHeader>
            <CardContent className="flex h-[65vh] flex-col">
              <Conversation className="min-h-0 flex-1">
                <ConversationContent
                  className={
                    messages.length === 0
                      ? "flex min-h-full flex-col items-center justify-center gap-4 p-4"
                      : "pr-2"
                  }
                >
                  {messages.length === 0 ? (
                    <ConversationEmptyState
                      title={projectId ? "Start a project conversation" : "Pick a project"}
                      description={
                        projectId
                          ? "Ask questions about the timeline, get editing suggestions, or talk through what to change next."
                          : "Choose a project to start a project-scoped chat."
                      }
                    />
                  ) : (
                    messages.map((message) => (
                      <Message
                        key={message.id}
                        from={message.role === "user" ? "user" : "assistant"}
                      >
                        <MessageContent>
                          {message.parts.map((part, index) =>
                            part.type === "text" ? (
                              <MessageResponse key={`${message.id}-${index}`}>
                                {part.text}
                              </MessageResponse>
                            ) : null,
                          )}
                        </MessageContent>
                      </Message>
                    ))
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>

              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                <Label htmlFor="agent-input">Message</Label>
                <textarea
                  id="agent-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3"
                  placeholder={
                    projectId
                      ? "Ask about the edit, the structure, or what to change next..."
                      : "Select a project first..."
                  }
                />
                <Button
                  type="submit"
                  disabled={
                    !projectId || !input.trim() || status === "submitted" || status === "streaming"
                  }
                >
                  {status === "submitted" || status === "streaming" ? (
                    <SpinnerGap className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="mr-2 h-4 w-4" />
                  )}
                  Send
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <SpinnerGap className="h-4 w-4 animate-spin" />
                  Loading project...
                </div>
              ) : project ? (
                <>
                  <div className="space-y-1">
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {project.composition_settings.width}x{project.composition_settings.height} •{" "}
                      {formatFramesToDuration(
                        project.composition_settings.durationInFrames,
                        project.composition_settings.fps,
                      )}
                    </p>
                  </div>
                  <div className="aspect-video overflow-hidden rounded-xl border border-border bg-black">
                    <Player
                      component={EditorComposition}
                      inputProps={{ project }}
                      durationInFrames={project.composition_settings.durationInFrames}
                      compositionWidth={project.composition_settings.width}
                      compositionHeight={project.composition_settings.height}
                      fps={project.composition_settings.fps}
                      style={{ width: "100%", height: "100%" }}
                      controls={false}
                      clickToPlay={false}
                      acknowledgeRemotionLicense
                    />
                  </div>
                  <Button asChild className="w-full">
                    <Link href={`/editor/${project.id}`}>Open Full Editor</Link>
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Choose a project to show its preview and bind the chat thread.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
