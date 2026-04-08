"use client"

import * as React from "react"
import Image from "next/image"
import { Sparkle } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { EDITOR_RUNTIME_EVENT } from "@/lib/editor/runtime"
import type { EditorRuntimeContext } from "@/lib/editor/types"
import { CreativeAgentChat } from "@/components/chat/creative-agent-chat"
import { UNICAN_ASSISTANT_NAME } from "@/lib/constants/system-prompts"

export function AIChat() {
  const [open, setOpen] = React.useState(false)
  const [editorContext, setEditorContext] = React.useState<EditorRuntimeContext>({
    projectId: null,
    selectionItemIds: [],
    playheadFrame: 0,
    activeRoute: "other",
  })

  React.useEffect(() => {
    const handleOpen = () => setOpen(true)
    const handleRuntimeContext = (event: Event) => {
      const customEvent = event as CustomEvent<EditorRuntimeContext>
      setEditorContext(customEvent.detail)
    }

    window.addEventListener("chat-open", handleOpen as EventListener)
    window.addEventListener(EDITOR_RUNTIME_EVENT, handleRuntimeContext as EventListener)

    return () => {
      window.removeEventListener("chat-open", handleOpen as EventListener)
      window.removeEventListener(EDITOR_RUNTIME_EVENT, handleRuntimeContext as EventListener)
    }
  }, [])

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed right-6 bottom-6 z-60 h-14 w-14 rounded-full shadow-lg"
        size="icon"
      >
        <Image src="/logo.svg" alt="" width={22} height={22} className="dark:invert" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex h-full w-full max-w-[540px] flex-col overflow-hidden p-0">
          <SheetHeader className="px-4 py-4 text-left">
            <SheetTitle className="flex items-center gap-2">
              <Sparkle className="h-4 w-4" />
              {UNICAN_ASSISTANT_NAME}
            </SheetTitle>
            <SheetDescription>
              {editorContext.projectId
                ? "Project-aware creative chat"
                : "Creative chat"}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <CreativeAgentChat compact initialProjectId={editorContext.projectId} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
