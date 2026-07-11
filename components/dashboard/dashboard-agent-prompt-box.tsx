"use client"

import * as React from "react"
import { ArrowUp, CircleNotch, FolderOpen, Plus, X } from "@phosphor-icons/react"
import { CommandTextarea } from "@/components/commands/command-textarea"
import { attachedRefFromAssetPick } from "@/components/chat/composer/attachments"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CHAT_AGENT_COMMANDS } from "@/lib/commands/presets-chat"
import type { AttachedRef } from "@/lib/commands/types"
import {
  CHAT_GATEWAY_MODEL_OPTIONS,
  getChatGatewayModelOption,
} from "@/lib/constants/chat-llm-models"
import { cn } from "@/lib/utils"

export function DashboardAgentPromptBox({
  promptValue,
  onPromptChange,
  attachedRefs,
  onAttachedRefsChange,
  selectedModelId,
  onModelChange,
  onSubmit,
  onOpenFullAgent,
  isSubmitting = false,
  className,
}: {
  promptValue: string
  onPromptChange: (value: string) => void
  attachedRefs: AttachedRef[]
  onAttachedRefsChange: (refs: AttachedRef[]) => void
  selectedModelId: string
  onModelChange: (value: string) => void
  onSubmit: () => void
  onOpenFullAgent?: () => void
  isSubmitting?: boolean
  className?: string
}) {
  const [assetModalOpen, setAssetModalOpen] = React.useState(false)
  const selectedModel = getChatGatewayModelOption(selectedModelId)
  const isTransparent = className?.includes("!bg-transparent")

  const handleAssetSelect = React.useCallback((pick: AssetSelectionPick) => {
    onAttachedRefsChange([
      ...attachedRefs,
      attachedRefFromAssetPick(pick),
    ])
    setAssetModalOpen(false)
  }, [attachedRefs, onAttachedRefsChange])

  const isReady = promptValue.trim().length > 0 || attachedRefs.length > 0

  return (
    <>
      <div className={cn("w-full", isTransparent && "p-2", className)}>
        {attachedRefs.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedRefs.map((ref) => (
              <div
                key={ref.chipId}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-foreground/85"
              >
                <span className="max-w-[14rem] truncate">{ref.label || "Reference"}</span>
                <button
                  type="button"
                  onClick={() => onAttachedRefsChange(attachedRefs.filter((item) => item.chipId !== ref.chipId))}
                  className="rounded-full p-0.5 text-foreground/60 transition hover:bg-background hover:text-foreground"
                  aria-label={`Remove ${ref.label || "reference"}`}
                >
                  <X className="size-3" weight="bold" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="rounded-[26px] transition-[box-shadow,ring-color]">
          <InputGroup
            className={cn(
              "items-end rounded-[22px] p-1 has-[textarea]:rounded-[22px]",
              isTransparent
                ? "bg-transparent border-transparent shadow-none backdrop-blur-none"
                : "composer-depth border-black/10 bg-background/95 backdrop-blur-sm dark:border-border/60"
            )}
          >
            <CommandTextarea
              textareaId="dashboard-agent-hero-textarea"
              value={promptValue}
              onChange={onPromptChange}
              refs={attachedRefs}
              onRefsChange={onAttachedRefsChange}
              rows={3}
              className={cn(
                "min-h-[60px] max-h-[120px] flex-1",
                isTransparent ? "px-1 py-0" : "px-3 py-1.5"
              )}
              placeholder="Describe what you want. / for shortcuts, @ for brands & assets."
              slashCommands={CHAT_AGENT_COMMANDS}
              slashCommandsContext="Agent"
              onPromptKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  if (isReady && !isSubmitting) onSubmit()
                }
              }}
            />
            <InputGroupAddon
              align="block-end"
              className={cn("justify-between gap-2", isTransparent && "!pb-0 !pt-1 px-1")}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Attach files or assets"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" sideOffset={4}>
                    <DropdownMenuItem onClick={() => setAssetModalOpen(true)}>
                      <FolderOpen className="mr-2 size-4" />
                      Select asset
                    </DropdownMenuItem>
                    {onOpenFullAgent ? (
                      <DropdownMenuItem onClick={onOpenFullAgent}>
                        <ArrowUp className="mr-2 size-4" />
                        Open full agent
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Select value={selectedModelId} onValueChange={onModelChange}>
                  <SelectTrigger
                    size="sm"
                    aria-label="Chat model"
                    className="h-9 w-fit min-w-0 max-w-[min(100%,16rem)] shrink border-border/50 bg-background/40 px-2.5 hover:bg-background/60"
                  >
                    <SelectValue placeholder="Model">
                      <div className="flex min-w-0 items-center gap-2">
                        <ModelIcon
                          identifier={selectedModel.id}
                          size={16}
                          srcOverride={selectedModel.iconPath}
                        />
                        <span className="truncate">{selectedModel.label}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    position="popper"
                    sideOffset={4}
                    className="w-[min(calc(100vw-2rem),22rem)]"
                  >
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
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  onClick={onSubmit}
                  disabled={!isReady || isSubmitting}
                  className="size-8 rounded-full"
                  aria-label="Send message"
                >
                  {isSubmitting ? (
                    <CircleNotch className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>

      <AssetSelectionModal
        open={assetModalOpen}
        onOpenChange={setAssetModalOpen}
        onSelect={handleAssetSelect}
      />
    </>
  )
}
