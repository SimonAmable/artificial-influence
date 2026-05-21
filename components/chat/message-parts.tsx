"use client"

import * as React from "react"
import Link from "next/link"
import type { UIMessage } from "ai"
import { CircleNotch, Images, PencilSimple, SpeakerHigh } from "@phosphor-icons/react"
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning"
import { MessageResponse } from "@/components/ai-elements/message"
import { ImageGrid, type ImageGridAgentAction } from "@/components/shared/display/image-grid"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import { formatCredits } from "@/components/chat/tool-ui/badges"
import { extractInlineImageUrlsFromText } from "@/components/chat/chat-media-utils"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type {
  ActivateSkillToolPart,
  AwaitGenerationToolPart,
  CapturePageScreenshotToolPart,
  ComposeTimelineVideoToolPart,
  DownloadSocialReferenceToolPart,
  ExtractVideoFramesToolPart,
  GenerateAudioToolPart,
  GenerateImageToolPart,
  GenerateVideoToolPart,
  GetBrandContextToolPart,
  InstagramConnectionToolSummary,
  ListAutomationsToolPart,
  ListInstagramConnectionsToolPart,
  ListRecentGenerationsToolPart,
  ListSocialConnectionsToolPart,
  ListThreadMediaToolPart,
  ManageAutomationToolPart,
  ModelsToolPart,
  PrepareInstagramPostToolPart,
  PrepareSocialPostToolPart,
  ReadWebPageToolPart,
  SaveGenerationAsAssetToolPart,
  SaveSkillToolPart,
  ScheduleGenerationFollowUpToolPart,
  SearchAssetsToolPart,
  SearchStockReferencesToolPart,
  SearchVoicesToolPart,
  SearchWebImagesToolPart,
  SearchWebToolPart,
  SocialConnectionToolSummary,
  UniversalGenerateImageToolPart,
} from "@/lib/chat/agent-tool-part-types"
import {
  formatAutomationActionLabel,
  formatAutomationDate,
  getAutomationPromptPreview,
} from "@/components/chat/tool-ui/automation-helpers"
import { AudioGenerationResultCard } from "@/components/chat/tool-ui/audio-generation-result-card"
import { ImageGenerationResultCard } from "@/components/chat/tool-ui/image-generation-result-card"
import { MessageFilePart } from "@/components/chat/tool-ui/user-message-parts"
import { VideoGenerationResultCard } from "@/components/chat/tool-ui/video-generation-result-card"
import {
  collectConsecutiveReasoningParts,
  humanizeToolPartType,
  inferSocialUrlLabel,
  truncateMiddle,
} from "@/components/chat/tool-ui/message-helpers"
import {
  formatInstagramSchedule,
  InstagramMediaPreview,
  socialAccountLabel,
  socialProviderLabel,
  SocialPostMediaPreview,
} from "@/components/chat/tool-ui/social-previews"
export function MessageParts({
  message,
  allMessages,
  instagramConnectionsById,
  socialConnectionsById = new Map(),
  onEditSkillRequest,
  onToolApprovalResponse,
  onImageGridAgentAction,
  onCreateAssetFromImage,
}: {
  message: UIMessage
  allMessages?: UIMessage[]
  instagramConnectionsById: Map<string, InstagramConnectionToolSummary>
  socialConnectionsById?: Map<string, SocialConnectionToolSummary>
  onEditSkillRequest?: (slug: string) => void
  onToolApprovalResponse: (approvalId: string, approved: boolean) => void
  onImageGridAgentAction?: (action: ImageGridAgentAction, image: {
    url: string
    prompt?: string | null
    model?: string | null
    aspectRatio?: string | null
    referenceImageUrls?: string[]
  }) => void
  onCreateAssetFromImage?: (imageUrl: string, index: number) => void
}) {
  const transcriptMessages = allMessages ?? [message]
  return (
    <>
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          const inlineImageUrls = extractInlineImageUrlsFromText(part.text)
          return (
            <div key={`${message.id}-${index}`} className="space-y-3">
              <MessageResponse>
                {part.text}
              </MessageResponse>
              {inlineImageUrls.map((url) => (
                <img
                  key={`${message.id}-${index}-${url}`}
                  src={url}
                  alt=""
                  className="max-h-[480px] w-full rounded-xl border border-border/60 object-contain"
                  loading="lazy"
                />
              ))}
            </div>
          )
        }

        if (part.type === "reasoning") {
          if (index > 0 && message.parts[index - 1]?.type === "reasoning") {
            return null
          }

          const reasoningParts = collectConsecutiveReasoningParts(message.parts, index)
          const reasoningText = reasoningParts
            .map((reasoningPart) => reasoningPart.text)
            .filter((text) => text.trim().length > 0)
            .join("\n\n")
          const isStreaming = reasoningParts.some((reasoningPart) => reasoningPart.state === "streaming")

          return (
            <Reasoning
              key={`${message.id}-${index}`}
              className="w-full"
              defaultOpen={isStreaming}
              isStreaming={isStreaming}
            >
              <ReasoningTrigger />
              <ReasoningContent>{reasoningText}</ReasoningContent>
            </Reasoning>
          )
        }

        if (part.type === "file") {
          return (
            <MessageFilePart
              key={`${message.id}-${index}`}
              messageId={message.id}
              part={part}
              partIndex={index}
            />
          )
        }

        if (part.type === "tool-generateImageWithNanoBanana") {
          const toolPart = part as GenerateImageToolPart
          return (
            <ImageGenerationResultCard
              key={`${message.id}-${index}`}
              badgeLabel="Generated"
              messageId={`${message.id}-${index}`}
              modelFallback="google/nano-banana-2"
              part={toolPart}
              title="Nano Banana Tool"
              allMessages={transcriptMessages}
              onImageGridAgentAction={onImageGridAgentAction}
              onCreateAssetFromImage={onCreateAssetFromImage}
            />
          )
        }

        if (part.type === "tool-generateImage") {
          const toolPart = part as UniversalGenerateImageToolPart
          return (
            <ImageGenerationResultCard
              key={`${message.id}-${index}`}
              badgeLabel="Generated"
              messageId={`${message.id}-${index}`}
              modelFallback="openai/gpt-image-2"
              part={toolPart}
              title="Image Generation Tool"
              allMessages={transcriptMessages}
              onImageGridAgentAction={onImageGridAgentAction}
              onCreateAssetFromImage={onCreateAssetFromImage}
            />
          )
        }

        if (part.type === "tool-generateVideo") {
          const toolPart = part as GenerateVideoToolPart
          return <VideoGenerationResultCard key={`${message.id}-${index}`} messageId={`${message.id}-${index}`} part={toolPart} />
        }

        if (part.type === "tool-generateAudio") {
          const toolPart = part as GenerateAudioToolPart
          return <AudioGenerationResultCard key={`${message.id}-${index}`} messageId={`${message.id}-${index}`} part={toolPart} />
        }

        if (part.type === "tool-extractVideoFrames") {
          const toolPart = part as ExtractVideoFramesToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Extracting video frames</p>
                    <p className="truncate text-xs text-muted-foreground">Sampling your clip with ffmpeg</p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Frame extraction failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const frames = toolPart.output?.frames ?? []
          const imageGridImages = frames.map((frame) => ({
            id: frame.mediaId,
            url: frame.publicUrl,
            model: "extractVideoFrames",
            prompt: frame.label,
            tool: "extractVideoFrames",
            aspectRatio: null as string | null,
          }))

          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Video frames</Badge>
                  {typeof toolPart.output?.frameCount === "number" ? (
                    <Badge variant="outline">
                      {toolPart.output.frameCount} frame{toolPart.output.frameCount === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                  {typeof toolPart.output?.videoDurationSec === "number" ? (
                    <Badge variant="outline">{toolPart.output.videoDurationSec.toFixed(2)}s clip</Badge>
                  ) : null}
                  {toolPart.output?.persistedToThread ? (
                    <Badge variant="outline">On thread</Badge>
                  ) : (
                    <Badge variant="outline">Ephemeral</Badge>
                  )}
                </div>
                {toolPart.output?.note ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.note}</p>
                ) : null}
                {imageGridImages.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
                    <ImageGrid images={imageGridImages} className="h-auto" basicActionsOnly initialColumnCount={1} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No frames returned.</p>
                )}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-composeTimelineVideo") {
          const toolPart = part as ComposeTimelineVideoToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Composing timeline video</p>
                    <p className="truncate text-xs text-muted-foreground">Stitching segments with ffmpeg</p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Timeline composition failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const v = toolPart.output?.video
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Composed video</Badge>
                  {toolPart.output?.outputPreset ? (
                    <Badge variant="outline">{toolPart.output.outputPreset}</Badge>
                  ) : null}
                  {typeof toolPart.output?.segmentCount === "number" ? (
                    <Badge variant="outline">
                      {toolPart.output.segmentCount} segment{toolPart.output.segmentCount === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                  {typeof toolPart.output?.videoDurationSec === "number" ? (
                    <Badge variant="outline">{toolPart.output.videoDurationSec.toFixed(2)}s</Badge>
                  ) : null}
                  {typeof toolPart.output?.creditsUsed === "number" ? (
                    <Badge variant="outline">{toolPart.output.creditsUsed} credits</Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {v?.url ? (
                  <video
                    src={v.url}
                    controls
                    playsInline
                    className="max-h-[420px] w-full rounded-2xl border border-border/60 bg-black"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No video URL returned.</p>
                )}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-listSocialConnections") {
          const toolPart = part as unknown as ListSocialConnectionsToolPart
          const providerLabel = socialProviderLabel(toolPart.output?.provider ?? toolPart.input?.provider ?? null)

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Checking social connections</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Looking up connected {toolPart.input?.provider ? providerLabel : "social"} accounts
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Social account lookup failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const connections = toolPart.output?.connections ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{toolPart.output?.provider ? `${providerLabel} Accounts` : "Social Accounts"}</Badge>
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">
                      {toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                <div className="space-y-2">
                  {connections.map((connection) => (
                    <div
                      key={connection.id}
                      className="rounded-xl border border-border/60 bg-background/80 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {socialAccountLabel(connection, connection.id.slice(0, 8))}
                        </p>
                        <Badge variant="outline">{socialProviderLabel(connection.provider)}</Badge>
                        {connection.accountType ? <Badge variant="outline">{connection.accountType}</Badge> : null}
                        <Badge variant="outline">{connection.id.slice(0, 8)}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>Updated {new Date(connection.updatedAt).toLocaleString()}</span>
                        {connection.tokenExpiresAt ? (
                          <span>Token expires {new Date(connection.tokenExpiresAt).toLocaleString()}</span>
                        ) : null}
                        {connection.profileFetchedAt ? (
                          <span>Profile fetched {new Date(connection.profileFetchedAt).toLocaleString()}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-listInstagramConnections") {
          const toolPart = part as unknown as ListInstagramConnectionsToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Checking Instagram connections</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Looking up connected Instagram accounts
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Instagram account lookup failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const connections = toolPart.output?.connections ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Instagram Accounts</Badge>
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">
                      {toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                <div className="space-y-2">
                  {connections.map((connection) => (
                    <div
                      key={connection.id}
                      className="rounded-xl border border-border/60 bg-background/80 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {connection.instagramUsername || "Unnamed Instagram account"}
                        </p>
                        {connection.accountType ? (
                          <Badge variant="outline">{connection.accountType}</Badge>
                        ) : null}
                        <Badge variant="outline">{connection.id.slice(0, 8)}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>Updated {new Date(connection.updatedAt).toLocaleString()}</span>
                        {connection.tokenExpiresAt ? (
                          <span>Token expires {new Date(connection.tokenExpiresAt).toLocaleString()}</span>
                        ) : null}
                        {connection.profileFetchedAt ? (
                          <span>Profile fetched {new Date(connection.profileFetchedAt).toLocaleString()}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-prepareSocialPost") {
          const toolPart = part as unknown as PrepareSocialPostToolPart
          const resolvedAccount =
            toolPart.output?.account
            ?? (toolPart.input ? socialConnectionsById.get(toolPart.input.connectionId) : undefined)
          const scheduleLabel =
            formatInstagramSchedule(toolPart.output?.post?.scheduledAt)
            ?? formatInstagramSchedule(toolPart.input?.scheduledAt)
          const providerLabel = socialProviderLabel(toolPart.output?.provider ?? toolPart.input?.provider ?? null)
          const mediaTypeLabel =
            toolPart.input?.provider === "instagram"
              ? toolPart.input.mediaType
              : toolPart.input?.postType === "photo"
                ? "photo"
                : "video"

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Preparing social post</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Building the post summary for approval
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "approval-requested") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{providerLabel} Approval</Badge>
                    {toolPart.input?.action ? <Badge variant="outline">{toolPart.input.action}</Badge> : null}
                    {mediaTypeLabel ? <Badge variant="outline">{mediaTypeLabel}</Badge> : null}
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      {socialAccountLabel(resolvedAccount, toolPart.input?.connectionId)}
                    </p>
                    <p className="text-muted-foreground">
                      {toolPart.input?.action === "schedule"
                        ? `Schedule this ${providerLabel} post${scheduleLabel ? ` for ${scheduleLabel}` : ""}?`
                        : toolPart.input?.action === "publish"
                          ? toolPart.input.provider === "tiktok"
                            ? toolPart.input.mode === "upload"
                              ? "Send this post to TikTok inbox now?"
                              : "Submit this post to TikTok now?"
                            : `Publish this post to ${providerLabel} now?`
                          : "Save this post as a draft?"}
                    </p>
                  </div>
                  {toolPart.input?.caption ? (
                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caption</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                        {toolPart.input.caption}
                      </p>
                    </div>
                  ) : null}
                  {toolPart.input?.provider === "tiktok" && toolPart.input.description ? (
                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                        {toolPart.input.description}
                      </p>
                    </div>
                  ) : null}
                  <SocialPostMediaPreview input={toolPart.input} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => toolPart.approval?.id && onToolApprovalResponse(toolPart.approval.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toolPart.approval?.id && onToolApprovalResponse(toolPart.approval.id, false)}
                    >
                      Deny
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "approval-responded") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Processing approval</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.approval?.approved ? "Finishing the social post request" : "Recording the denial"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-denied") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
                <CardContent className="space-y-2 p-4 text-sm">
                  <p className="font-medium">{providerLabel} post not created</p>
                  <p className="text-muted-foreground">The approval request was denied, so no post was saved.</p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">{providerLabel} post failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>
                    {toolPart.output?.post?.status === "published"
                      ? `${providerLabel} Published`
                      : toolPart.output?.post?.status === "queued"
                        ? `${providerLabel} Scheduled`
                        : toolPart.output?.post?.status === "processing"
                          ? `${providerLabel} Submitted`
                          : `${providerLabel} Draft`}
                  </Badge>
                  {toolPart.output?.post?.mediaType ? <Badge variant="outline">{toolPart.output.post.mediaType}</Badge> : null}
                  {resolvedAccount ? (
                    <Badge variant="outline">{socialAccountLabel(resolvedAccount, null)}</Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {toolPart.output?.post ? (
                  <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Job {toolPart.output.post.id.slice(0, 8)}</span>
                      <span>Created {new Date(toolPart.output.post.createdAt).toLocaleString()}</span>
                      {scheduleLabel ? <span>Scheduled {scheduleLabel}</span> : null}
                    </div>
                    {toolPart.output.post.caption ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                        {toolPart.output.post.caption}
                      </p>
                    ) : null}
                    {toolPart.output?.provider === "tiktok" && toolPart.output.post.metadata?.tiktok?.description ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {toolPart.output.post.metadata.tiktok.description}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <SocialPostMediaPreview input={toolPart.input} />
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-prepareInstagramPost") {
          const toolPart = part as unknown as PrepareInstagramPostToolPart
          const resolvedAccount = toolPart.output?.instagramAccount
            ?? (toolPart.input
              ? instagramConnectionsById.get(toolPart.input.instagramConnectionId)
              : undefined)
          const scheduleLabel =
            formatInstagramSchedule(toolPart.output?.post?.scheduledAt)
            ?? formatInstagramSchedule(toolPart.input?.scheduledAt)

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Preparing Instagram post</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Building the post summary for approval
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "approval-requested") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Instagram Approval</Badge>
                    {toolPart.input?.action ? <Badge variant="outline">{toolPart.input.action}</Badge> : null}
                    {toolPart.input?.mediaType ? <Badge variant="outline">{toolPart.input.mediaType}</Badge> : null}
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      {resolvedAccount?.instagramUsername || toolPart.input?.instagramConnectionId || "Instagram account"}
                    </p>
                    <p className="text-muted-foreground">
                      {toolPart.input?.action === "schedule"
                        ? `Schedule this post${scheduleLabel ? ` for ${scheduleLabel}` : ""}?`
                        : toolPart.input?.action === "publish"
                          ? "Publish this post to Instagram now?"
                          : "Save this post as a draft?"}
                    </p>
                  </div>
                  {toolPart.input?.caption ? (
                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caption</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                        {toolPart.input.caption}
                      </p>
                    </div>
                  ) : null}
                  <InstagramMediaPreview input={toolPart.input} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => toolPart.approval?.id && onToolApprovalResponse(toolPart.approval.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toolPart.approval?.id && onToolApprovalResponse(toolPart.approval.id, false)}
                    >
                      Deny
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "approval-responded") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Processing approval</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.approval?.approved ? "Finishing the Instagram post request" : "Recording the denial"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-denied") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
                <CardContent className="space-y-2 p-4 text-sm">
                  <p className="font-medium">Instagram post not created</p>
                  <p className="text-muted-foreground">The approval request was denied, so no post was saved.</p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Instagram post failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>
                    {toolPart.output?.post?.status === "published"
                      ? "Instagram Published"
                      : toolPart.output?.post?.status === "queued"
                        ? "Instagram Scheduled"
                        : "Instagram Draft"}
                  </Badge>
                  {toolPart.output?.post?.mediaType ? <Badge variant="outline">{toolPart.output.post.mediaType}</Badge> : null}
                  {resolvedAccount?.instagramUsername ? (
                    <Badge variant="outline">{resolvedAccount.instagramUsername}</Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {toolPart.output?.post ? (
                  <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Job {toolPart.output.post.id.slice(0, 8)}</span>
                      <span>Created {new Date(toolPart.output.post.createdAt).toLocaleString()}</span>
                      {scheduleLabel ? <span>Scheduled {scheduleLabel}</span> : null}
                    </div>
                    {toolPart.output.post.caption ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                        {toolPart.output.post.caption}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <InstagramMediaPreview input={toolPart.input} />
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-listModels" || part.type === "tool-searchModels") {
          const toolPart = part as ModelsToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Loading models</p>
                    <p className="truncate text-xs text-muted-foreground">Listing all active models</p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Model list failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const models = toolPart.output?.models ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Models</Badge>
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">{toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}</Badge>
                  ) : null}
                  {toolPart.output?.defaultImageModel ? (
                    <Badge variant="outline">Default image: {toolPart.output.defaultImageModel}</Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {models.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="model-results" className="border border-border/60 rounded-xl bg-background/70 px-3">
                      <AccordionTrigger className="py-3 text-sm hover:no-underline">
                        <span className="flex flex-wrap items-center gap-2 text-left">
                          <span className="font-medium">Show models</span>
                          <Badge variant="outline">{models.length} total</Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {models.map((model) => (
                            <div
                              key={model.identifier}
                              className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/80 p-3"
                            >
                              <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
                                <ModelIcon identifier={model.identifier} size={20} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold leading-snug">{model.name}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Badge variant="outline" className="capitalize">
                                    {model.type}
                                  </Badge>
                                  {typeof model.modelCost === "number" ? (
                                    <Badge variant="outline">{formatCredits(model.modelCost)} credits</Badge>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : null}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-searchVoices") {
          const toolPart = part as SearchVoicesToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Searching voices</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.input?.query
                        ? `Looking for ${toolPart.input.query}`
                        : `Loading ${toolPart.input?.provider || "available"} voices`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Voice search failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const voices = toolPart.output?.voices ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Voices</Badge>
                  {toolPart.output?.provider ? (
                    <Badge variant="outline">{toolPart.output.provider}</Badge>
                  ) : null}
                  {toolPart.output?.source ? (
                    <Badge variant="outline">{toolPart.output.source}</Badge>
                  ) : null}
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">{toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}</Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {voices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No voices matched that search.</p>
                ) : (
                  <div className="space-y-2">
                    {voices.map((voice) => (
                      <div key={`${voice.provider ?? "unknown"}:${voice.voiceId}`} className="rounded-xl border border-border/60 bg-background/80 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{voice.displayName}</p>
                          <Badge variant="outline">{voice.voiceId}</Badge>
                          {voice.provider ? <Badge variant="outline">{voice.provider}</Badge> : null}
                          <Badge variant="outline">{voice.source}</Badge>
                          {voice.langCode ? <Badge variant="outline">{voice.langCode}</Badge> : null}
                        </div>
                        {voice.description ? (
                          <p className="mt-2 text-xs text-muted-foreground">{voice.description}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {voice.model ? <Badge variant="outline">{voice.model}</Badge> : null}
                          {voice.tags.slice(0, 6).map((tag) => (
                            <Badge key={`${voice.voiceId}-${tag}`} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        {voice.previewText ? (
                          <p className="mt-2 text-[11px] text-muted-foreground">{voice.previewText}</p>
                        ) : null}
                        {voice.previewAudioUrl ? (
                          <audio
                            src={voice.previewAudioUrl}
                            controls
                            className="mt-3 w-full rounded-lg border border-border/60 bg-background p-2"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-searchWeb") {
          const toolPart = part as SearchWebToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Searching the web</p>
                    <p className="truncate text-xs text-muted-foreground">{toolPart.input?.query || "Finding links"}</p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Web search failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const results = toolPart.output?.results ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Web Search</Badge>
                  {toolPart.output?.provider ? <Badge variant="outline">{toolPart.output.provider}</Badge> : null}
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">{toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}</Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                <div className="space-y-2">
                  {results.map((result) => (
                    <div key={result.url} className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <Link
                        href={result.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {result.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {result.source ? <span>{result.source}</span> : null}
                        <span className="truncate">{result.url}</span>
                      </div>
                      {result.snippet ? (
                        <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{result.snippet}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-readWebPage") {
          const toolPart = part as ReadWebPageToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Reading web page</p>
                    <p className="truncate text-xs text-muted-foreground">{toolPart.input?.url || "Extracting page content"}</p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Page read failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const page = toolPart.output?.page
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Web Page</Badge>
                  {toolPart.output?.provider ? <Badge variant="outline">{toolPart.output.provider}</Badge> : null}
                  {toolPart.output?.fallbackReason ? <Badge variant="outline">fallback used</Badge> : null}
                </div>
                {page ? (
                  <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                    {page.title ? <p className="text-sm font-medium">{page.title}</p> : null}
                    <Link
                      href={page.finalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      {page.finalUrl}
                    </Link>
                    {page.description ? (
                      <p className="mt-2 text-xs text-muted-foreground">{page.description}</p>
                    ) : null}
                    {page.text ? (
                      <p className="mt-3 line-clamp-5 text-xs text-foreground/80">{page.text}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{page.links.length} links</Badge>
                      <Badge variant="outline">{page.images.length} images</Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No page content returned.</p>
                )}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-searchWebImages") {
          const toolPart = part as SearchWebImagesToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Searching web images</p>
                    <p className="truncate text-xs text-muted-foreground">{toolPart.input?.query || "Finding image references"}</p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Web image search failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const images = toolPart.output?.images ?? []
          const imageGridImages = images.map((image, imageIndex) => ({
            id: `${image.sourcePageUrl}-${imageIndex}`,
            url: image.imageUrl,
            model: "web-image-search",
            prompt: image.title,
            tool: "searchWebImages",
            aspectRatio: null as string | null,
          }))

          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Web Images</Badge>
                  {toolPart.output?.provider ? <Badge variant="outline">{toolPart.output.provider}</Badge> : null}
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">{toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}</Badge>
                  ) : null}
                </div>
                {toolPart.output?.licenseNotice ? (
                  <p className="text-xs text-muted-foreground">{toolPart.output.licenseNotice}</p>
                ) : null}
                {imageGridImages.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
                    <ImageGrid images={imageGridImages} className="h-auto" basicActionsOnly initialColumnCount={2} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No image references returned.</p>
                )}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-searchStockReferences") {
          const toolPart = part as SearchStockReferencesToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Searching stock references</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.input?.query || "Looking for live external references"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Stock reference search failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const results = toolPart.output?.results ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Stock References</Badge>
                  {toolPart.output?.provider ? <Badge variant="outline">{toolPart.output.provider}</Badge> : null}
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">{toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}</Badge>
                  ) : null}
                  {toolPart.output?.mediaType ? (
                    <Badge variant="outline">{toolPart.output.mediaType}</Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {toolPart.output?.licenseNotice ? (
                  <p className="text-xs text-muted-foreground">{toolPart.output.licenseNotice}</p>
                ) : null}
                {results.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {results.map((result) => (
                      <div key={`${result.provider}-${result.id}`} className="overflow-hidden rounded-xl border border-border/60 bg-background/80">
                        <div className="aspect-[4/3] bg-muted">
                          {result.referenceVideoUrl ? (
                            <video
                              src={result.referenceVideoUrl}
                              muted
                              loop
                              autoPlay
                              playsInline
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <img
                              src={result.previewUrl}
                              alt={result.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <div className="space-y-2 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="line-clamp-1 text-sm font-medium">{result.title}</p>
                            <Badge variant="outline">{result.mediaType}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{result.attribution}</p>
                          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            {result.referenceImageUrl ? <span>image URL ready</span> : null}
                            {result.referenceVideoUrl ? <span>video URL ready</span> : null}
                            {result.width && result.height ? <span>{result.width}x{result.height}</span> : null}
                          </div>
                          <Link
                            href={result.pageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-xs text-muted-foreground underline-offset-4 hover:underline"
                          >
                            {result.pageUrl}
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No stock references returned.</p>
                )}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-capturePageScreenshot") {
          const toolPart = part as CapturePageScreenshotToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Capturing screenshot</p>
                    <p className="truncate text-xs text-muted-foreground">{toolPart.input?.url || "Rendering page"}</p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Screenshot failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const screenshot = toolPart.output?.screenshot
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Screenshot</Badge>
                  {screenshot?.provider ? <Badge variant="outline">{screenshot.provider}</Badge> : null}
                  {screenshot?.fullPage ? <Badge variant="outline">full page</Badge> : <Badge variant="outline">viewport</Badge>}
                  {screenshot ? <Badge variant="outline">{screenshot.viewportWidth}x{screenshot.viewportHeight}</Badge> : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {screenshot ? (
                  <div className="space-y-3">
                    <img
                      src={screenshot.url}
                      alt={`Screenshot of ${screenshot.sourceUrl}`}
                      className="max-h-[520px] w-full rounded-2xl border border-border/60 object-contain"
                      loading="lazy"
                    />
                    <Link
                      href={screenshot.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      {screenshot.sourceUrl}
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No screenshot returned.</p>
                )}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-searchAssets") {
          const toolPart = part as SearchAssetsToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Searching assets</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.input?.query
                        ? `Looking for ${toolPart.input.query}`
                        : `Loading ${toolPart.input?.assetType || "saved"} assets`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Asset search failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const assets = toolPart.output?.assets ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Assets</Badge>
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">{toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}</Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {assets.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {assets.map((asset) => {
                      const imagePreviewUrl = (asset.thumbnailUrl || asset.url || "").trim()
                      return (
                        <div
                          key={asset.id}
                          className="overflow-hidden rounded-xl border border-border/60 bg-background/80"
                        >
                          <div className="relative aspect-square bg-muted">
                            {asset.assetType === "image" && imagePreviewUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- remote storage URLs not in next/image domains
                              <img
                                src={imagePreviewUrl}
                                alt={asset.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : asset.assetType === "video" && asset.url.trim() ? (
                              <video
                                src={asset.url}
                                poster={asset.thumbnailUrl ?? undefined}
                                className="h-full w-full object-cover"
                                preload="metadata"
                                muted
                                playsInline
                                controls
                              />
                            ) : asset.assetType === "video" &&
                              typeof asset.thumbnailUrl === "string" &&
                              asset.thumbnailUrl.trim() ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={asset.thumbnailUrl}
                                alt={asset.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : asset.assetType === "audio" ? (
                              <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/80 p-2">
                                <SpeakerHigh className="size-9 shrink-0 text-muted-foreground" weight="duotone" aria-hidden />
                                {asset.url.trim() ? (
                                  <audio src={asset.url} controls className="h-8 w-full min-w-0 max-w-[200px]" />
                                ) : (
                                  <p className="text-center text-[11px] text-muted-foreground">No audio URL</p>
                                )}
                              </div>
                            ) : (
                              <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                                No preview available
                              </div>
                            )}
                          </div>
                          <div className="space-y-1.5 p-2.5">
                            <p className="line-clamp-2 text-xs font-medium leading-snug">{asset.title}</p>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] font-normal capitalize">
                                {asset.assetType}
                              </Badge>
                              <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] font-normal capitalize">
                                {asset.category}
                              </Badge>
                              <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] font-normal capitalize">
                                {asset.visibility}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No saved assets in this result.</p>
                )}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-listRecentGenerations") {
          const toolPart = part as ListRecentGenerationsToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Checking recent generations</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.input?.query
                        ? `Looking for ${toolPart.input.query}`
                        : `Loading recent ${toolPart.input?.type || "creative"} outputs`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Recent generations lookup failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const generations = toolPart.output?.generations ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Recent Generations</Badge>
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">
                      {toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                <div className="space-y-2">
                  {generations.map((generation) => (
                    <div key={generation.id} className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{generation.id}</p>
                        <Badge variant="outline">{generation.type}</Badge>
                        <Badge variant="outline">{generation.status}</Badge>
                        {generation.aspectRatio ? (
                          <Badge variant="outline">{generation.aspectRatio}</Badge>
                        ) : null}
                        {generation.linkedAsset ? (
                          <Badge>{`Saved as ${generation.linkedAsset.title}`}</Badge>
                        ) : null}
                      </div>
                      {generation.prompt ? (
                        <p className="mt-2 text-xs text-muted-foreground">{generation.prompt}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {generation.model ? <span>{generation.model}</span> : null}
                        <span>{new Date(generation.createdAt).toLocaleString()}</span>
                      </div>
                      {generation.type === "audio" && generation.url ? (
                        <audio
                          src={generation.url}
                          controls
                          className="mt-3 w-full rounded-lg border border-border/60 bg-background p-2"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-listAutomations") {
          const toolPart = part as unknown as ListAutomationsToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Loading automations</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Looking up existing automation schedules and status
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Automation lookup failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const automations = toolPart.output?.automations ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Automations</Badge>
                  {typeof toolPart.output?.total === "number" ? (
                    <Badge variant="outline">
                      {toolPart.output.total} result{toolPart.output.total === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {automations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No automations found.</p>
                ) : (
                  <div className="space-y-2">
                    {automations.map((automation) => (
                      <div
                        key={automation.id}
                        className="rounded-xl border border-border/60 bg-background/80 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{automation.name}</p>
                          <Badge variant="outline">{automation.isActive ? "active" : "paused"}</Badge>
                          <Badge variant="outline">{automation.id.slice(0, 8)}</Badge>
                          {automation.model ? <Badge variant="outline">{automation.model}</Badge> : null}
                        </div>
                        {automation.description ? (
                          <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                            {automation.description}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          {automation.scheduleSummary ? <span>{automation.scheduleSummary}</span> : null}
                          {automation.timezone ? <span>{automation.timezone}</span> : null}
                          {formatAutomationDate(automation.nextRunAt) ? (
                            <span>Next {formatAutomationDate(automation.nextRunAt)}</span>
                          ) : null}
                          {formatAutomationDate(automation.lastRunAt) ? (
                            <span>Last {formatAutomationDate(automation.lastRunAt)}</span>
                          ) : null}
                          {typeof automation.runCount === "number" ? (
                            <span>{automation.runCount} run{automation.runCount === 1 ? "" : "s"}</span>
                          ) : null}
                        </div>
                        {automation.lastError ? (
                          <p className="mt-2 text-xs text-destructive">{automation.lastError}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-manageAutomation") {
          const toolPart = part as unknown as ManageAutomationToolPart
          const summary = toolPart.output?.automation
          const inputSummary = toolPart.input
          const action = toolPart.output?.action ?? toolPart.input?.action
          const promptPreview =
            getAutomationPromptPreview(summary?.promptExcerpt) ??
            getAutomationPromptPreview(inputSummary?.promptText)

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{formatAutomationActionLabel(action)} automation</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Preparing the automation action for approval
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "approval-requested") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Automation Approval</Badge>
                    {action ? <Badge variant="outline">{formatAutomationActionLabel(action)}</Badge> : null}
                    {inputSummary?.model ? <Badge variant="outline">{inputSummary.model}</Badge> : null}
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      {inputSummary?.name || toolPart.output?.deletedAutomationName || inputSummary?.automationId || "Automation"}
                    </p>
                    {inputSummary?.description ? (
                      <p className="text-muted-foreground whitespace-pre-wrap">{inputSummary.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {inputSummary?.cronScheduleOrNaturalLanguage ? (
                      <Badge variant="outline">{inputSummary.cronScheduleOrNaturalLanguage}</Badge>
                    ) : null}
                    {inputSummary?.timezone ? <Badge variant="outline">{inputSummary.timezone}</Badge> : null}
                    {typeof inputSummary?.isActive === "boolean" ? (
                      <Badge variant="outline">{inputSummary.isActive ? "active" : "paused"}</Badge>
                    ) : null}
                  </div>
                  {promptPreview ? (
                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prompt</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{promptPreview}</p>
                    </div>
                  ) : null}
                  {action === "delete" ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      This will permanently delete the automation and its future scheduled runs.
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => toolPart.approval?.id && onToolApprovalResponse(toolPart.approval.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toolPart.approval?.id && onToolApprovalResponse(toolPart.approval.id, false)}
                    >
                      Deny
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "approval-responded") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Processing approval</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.approval?.approved ? "Applying the automation change" : "Recording the denial"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-denied") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
                <CardContent className="space-y-2 p-4 text-sm">
                  <p className="font-medium">Automation unchanged</p>
                  <p className="text-muted-foreground">
                    The approval request was denied, so no automation changes were saved.
                  </p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Automation action failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Automation</Badge>
                  {action ? <Badge variant="outline">{formatAutomationActionLabel(action)}</Badge> : null}
                  {summary?.model ? <Badge variant="outline">{summary.model}</Badge> : null}
                  {typeof summary?.isActive === "boolean" ? (
                    <Badge variant="outline">{summary.isActive ? "active" : "paused"}</Badge>
                  ) : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {action === "delete" ? (
                  <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                    <p className="text-sm font-medium">
                      {toolPart.output?.deletedAutomationName || "Automation"} deleted
                    </p>
                    {toolPart.output?.deletedAutomationId ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        ID {toolPart.output.deletedAutomationId.slice(0, 8)}
                      </p>
                    ) : null}
                  </div>
                ) : summary ? (
                  <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{summary.name}</p>
                      <Badge variant="outline">{summary.id.slice(0, 8)}</Badge>
                    </div>
                    {summary.description ? (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                        {summary.description}
                      </p>
                    ) : null}
                    {promptPreview ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{promptPreview}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {summary.scheduleSummary ? <span>{summary.scheduleSummary}</span> : null}
                      {summary.timezone ? <span>{summary.timezone}</span> : null}
                      {formatAutomationDate(summary.nextRunAt) ? (
                        <span>Next {formatAutomationDate(summary.nextRunAt)}</span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {toolPart.output?.threadId ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/chat/${toolPart.output.threadId}`}>Open Run Thread</Link>
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-listThreadMedia") {
          const toolPart = part as ListThreadMediaToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Loading thread media</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.input?.mediaKind && toolPart.input.mediaKind !== "all"
                        ? `Filter: ${toolPart.input.mediaKind}`
                        : "Listing uploads and generations for this chat"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Thread media list failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const items = toolPart.output?.items ?? []
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="gap-1">
                    <Images className="h-3.5 w-3.5" aria-hidden />
                    Thread media
                  </Badge>
                  {typeof toolPart.output?.count === "number" ? (
                    <Badge variant="outline">
                      {toolPart.output.count} item{toolPart.output.count === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  IDs here are valid <span className="font-mono">mediaIds</span> for image, video, and audio-aware tools. Use
                  listThreadMedia before referencing earlier chat media.
                </p>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No media registered for this thread yet.</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => {
                      const isImage = item.mimeType.startsWith("image/")
                      const isAudio = item.mimeType.startsWith("audio/")
                      return (
                        <div
                          key={item.id}
                          className="flex gap-3 rounded-xl border border-border/60 bg-background/80 p-3"
                        >
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                            {isImage ? (
                              <img
                                src={item.publicUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : isAudio ? (
                              <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-muted-foreground">
                                Audio
                              </div>
                            ) : (
                              <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-muted-foreground">
                                {item.mimeType}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium leading-snug">{item.label}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{item.mediaKind}</Badge>
                              <Badge variant="outline">{item.mimeType}</Badge>
                            </div>
                            <p className="font-mono text-[11px] text-muted-foreground break-all">
                              {item.id}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(item.createdAt).toLocaleString()}
                            </p>
                            {isAudio ? (
                              <audio src={item.publicUrl} controls className="mt-2 w-full" />
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-saveGenerationAsAsset") {
          const toolPart = part as SaveGenerationAsAssetToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Saving generation as asset</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.input?.title
                        ? `Creating ${toolPart.input.title}`
                        : `Saving generation ${toolPart.input?.generationId || ""}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card key={`${message.id}-${index}`} className="border-destructive/30 bg-destructive/5">
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Saving asset failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          const asset = toolPart.output?.asset
          return (
            <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{toolPart.output?.alreadySaved ? "Existing Asset" : "Asset Saved"}</Badge>
                  {asset ? <Badge variant="outline">{asset.assetType}</Badge> : null}
                  {asset ? <Badge variant="outline">{asset.category}</Badge> : null}
                  {asset ? <Badge variant="outline">{asset.visibility}</Badge> : null}
                </div>
                {toolPart.output?.message ? (
                  <p className="text-sm text-muted-foreground">{toolPart.output.message}</p>
                ) : null}
                {asset ? (
                  <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                    <p className="text-sm font-medium">{asset.title}</p>
                    {asset.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {asset.tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        }

        if (part.type === "tool-getBrandContext") {
          const toolPart = part as GetBrandContextToolPart

          if (toolPart.state === "input-streaming") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Looking up brand context...
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Checking brand context</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {toolPart.input?.brandName
                        ? `Matching ${toolPart.input.brandName}`
                        : "Resolving saved brand"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card
                key={`${message.id}-${index}`}
                className="border-destructive/30 bg-destructive/5"
              >
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Brand context lookup failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-available") {
            const output = toolPart.output
            const brand = output?.brand
            const availableBrands = output?.availableBrands ?? []

            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
                <CardContent className="space-y-3 p-4">
                  {brand ? (
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background">
                        {brand.iconUrl ? (
                          <img
                            src={brand.iconUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium text-muted-foreground">
                            {brand.name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{brand.name}</p>
                        {brand.websiteUrl ? (
                          <p className="truncate text-xs text-muted-foreground">{brand.websiteUrl}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {output?.message ? (
                    <p className="text-sm text-muted-foreground">{output.message}</p>
                  ) : null}

                  {!brand && availableBrands.length > 0 ? (
                    <div className="space-y-2">
                      {availableBrands.slice(0, 3).map((candidate) => (
                        <div key={candidate.id} className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background">
                            {candidate.iconUrl ? (
                              <img
                                src={candidate.iconUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-medium text-muted-foreground">
                                {candidate.name.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {candidate.name}
                              {candidate.isDefault ? " (default)" : ""}
                            </p>
                            {candidate.websiteUrl ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {candidate.websiteUrl}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          }
        }

        if (part.type === "tool-saveSkill") {
          const toolPart = part as SaveSkillToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Saving skillâ€¦
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card
                key={`${message.id}-${index}`}
                className="border-destructive/30 bg-destructive/5"
              >
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Skill save failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-available") {
            const output = toolPart.output
            const ok = output?.status === "saved"
            return (
              <Card
                key={`${message.id}-${index}`}
                className={
                  ok ? "border-border/60 bg-muted/10" : "border-destructive/30 bg-destructive/5"
                }
              >
                <CardContent className="space-y-1 p-4 text-sm">
                  <p className="font-medium">{ok ? "Skill saved" : "Skill not saved"}</p>
                  {output?.message ? <p className="text-muted-foreground">{output.message}</p> : null}
                </CardContent>
              </Card>
            )
          }
        }

        if (part.type === "tool-activateSkill") {
          const toolPart = part as ActivateSkillToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Loading skillâ€¦
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card
                key={`${message.id}-${index}`}
                className="border-destructive/30 bg-destructive/5"
              >
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Skill activation failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-available") {
            const output = toolPart.output
            const ok = output?.status === "ok"
            return (
              <Card
                key={`${message.id}-${index}`}
                className={
                  ok ? "border-border/60 bg-muted/10" : "border-destructive/30 bg-destructive/5"
                }
              >
                <CardContent className="space-y-3 p-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-medium">{ok ? "Skill loaded" : "Skill not loaded"}</p>
                    {output?.title?.trim() ? (
                      <p className="text-muted-foreground">{output.title.trim()}</p>
                    ) : null}
                    {output?.message ? <p className="text-muted-foreground">{output.message}</p> : null}
                  </div>
                  {ok && output?.isMine && typeof output.slug === "string" ? (
                    <div className="flex justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (output.slug) {
                            onEditSkillRequest?.(output.slug)
                          }
                        }}
                      >
                        <PencilSimple className="mr-2 size-4" />
                        Edit skill
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          }
        }

        if (part.type === "tool-scheduleGenerationFollowUp") {
          const toolPart = part as ScheduleGenerationFollowUpToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Scheduling automatic follow-up when generation finishesâ€¦
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card
                key={`${message.id}-${index}`}
                className="border-destructive/30 bg-destructive/5"
              >
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Could not schedule follow-up</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-available") {
            const output = toolPart.output
            const ok = output?.status === "scheduled"
            return (
              <Card
                key={`${message.id}-${index}`}
                className={
                  ok ? "border-border/60 bg-muted/10" : "border-destructive/30 bg-destructive/5"
                }
              >
                <CardContent className="space-y-1 p-4 text-sm">
                  <p className="font-medium">
                    {ok ? "Follow-up scheduled" : "Follow-up not scheduled"}
                  </p>
                  {output?.generationId ? (
                    <p className="font-mono text-xs text-muted-foreground">{output.generationId}</p>
                  ) : null}
                  {output?.message ? <p className="text-muted-foreground">{output.message}</p> : null}
                  {output?.error ? <p className="text-destructive">{output.error}</p> : null}
                </CardContent>
              </Card>
            )
          }
        }

        if (part.type === "tool-awaitGeneration") {
          const toolPart = part as AwaitGenerationToolPart

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            const waitSeconds = toolPart.input?.maxWaitSeconds
            return (
              <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Waiting for generation to finish
                  {typeof waitSeconds === "number" ? ` (up to ${waitSeconds}s)` : ""}â€¦
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <Card
                key={`${message.id}-${index}`}
                className="border-destructive/30 bg-destructive/5"
              >
                <CardContent className="space-y-2 p-4 text-sm text-destructive">
                  <p className="font-medium">Wait failed</p>
                  <p>{toolPart.errorText || "Unknown tool error."}</p>
                </CardContent>
              </Card>
            )
          }

          if (toolPart.state === "output-available") {
            const output = toolPart.output
            const status = output?.status
            if (status === "completed") {
              return (
                <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/10">
                  <CardContent className="space-y-1 p-4 text-sm">
                    <p className="font-medium">
                      {output?.kind === "video" ? "Video" : "Image"} ready
                    </p>
                    <p className="text-muted-foreground">Generation finished successfully.</p>
                  </CardContent>
                </Card>
              )
            }
            if (status === "timeout") {
              return (
                <Card key={`${message.id}-${index}`} className="border-border/60 bg-muted/20">
                  <CardContent className="space-y-1 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Still generatingâ€¦</p>
                    <p>
                      {output?.message ||
                        "The chat UI will update when it completes. Feel free to keep going."}
                    </p>
                  </CardContent>
                </Card>
              )
            }
            return (
              <Card
                key={`${message.id}-${index}`}
                className="border-destructive/30 bg-destructive/5"
              >
                <CardContent className="space-y-1 p-4 text-sm text-destructive">
                  <p className="font-medium">Generation failed</p>
                  <p>{output?.error || "Generation did not complete."}</p>
                </CardContent>
              </Card>
            )
          }
        }

        if (part.type === "tool-downloadSocialReference") {
          const toolPart = part as DownloadSocialReferenceToolPart
          const url = typeof toolPart.input?.url === "string" ? toolPart.input.url.trim() : ""
          const platformLabel = inferSocialUrlLabel(url || undefined)
          const fetchLabel = platformLabel === "post" ? "reference" : platformLabel

          if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
            return (
              <div
                key={`${message.id}-${index}`}
                className="flex max-w-full items-center gap-2.5 rounded-full border border-border/30 bg-foreground/[0.03] px-3.5 py-2 text-[13px] text-muted-foreground"
              >
                <CircleNotch className="h-3.5 w-3.5 shrink-0 animate-spin opacity-80" aria-hidden />
                <span className="min-w-0 leading-snug">
                  <span className="text-foreground/90">Fetching {fetchLabel}</span>
                  {url ? (
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground/90">
                      {truncateMiddle(url, 64)}
                    </span>
                  ) : null}
                </span>
              </div>
            )
          }

          if (toolPart.state === "output-error") {
            return (
              <div
                key={`${message.id}-${index}`}
                className="flex max-w-full flex-col gap-1 rounded-2xl border border-destructive/25 px-3.5 py-2 text-[13px]"
              >
                <span className="font-medium text-destructive">Could not save that post</span>
                <span className="text-destructive/90">{toolPart.errorText || "Download failed."}</span>
              </div>
            )
          }

          if (toolPart.state === "output-available") {
            const out = toolPart.output
            const urls = Array.isArray(out?.outputPublicUrls)
              ? out.outputPublicUrls.filter((href): href is string => typeof href === "string" && href.length > 0)
              : []
            const primary =
              typeof out?.outputPublicUrl === "string" && out.outputPublicUrl.length > 0
                ? out.outputPublicUrl
                : urls[0]
            const kind = out?.outputMediaKind
            const summary =
              typeof out?.message === "string" && out.message.trim().length > 0
                ? out.message.trim()
                : kind === "slideshow"
                  ? `Saved ${urls.length || "a"} reference image${urls.length === 1 ? "" : "s"}.`
                  : primary
                    ? "Reference saved."
                    : "Download finished."

            return (
              <div
                key={`${message.id}-${index}`}
                className="flex max-w-full flex-col gap-1.5 rounded-2xl border border-border/30 bg-foreground/[0.03] px-3.5 py-2.5 text-[13px]"
              >
                <span className="leading-snug text-foreground/90">{summary}</span>
                {primary ? (
                  <a
                    href={primary}
                    target="_blank"
                    rel="noreferrer"
                    className="w-fit text-sm font-medium text-sky-400 underline decoration-sky-400/40 underline-offset-[3px] hover:text-sky-300"
                  >
                    Open media
                  </a>
                ) : null}
                {kind === "slideshow" && urls.length > 1 ? (
                  <span className="text-[11px] text-muted-foreground">{urls.length} files on your thread</span>
                ) : null}
              </div>
            )
          }

          return null
        }

        if (typeof part.type === "string" && part.type.startsWith("tool-")) {
          const generic = part as {
            type: string
            state?: string
            input?: Record<string, unknown>
            output?: Record<string, unknown>
            errorText?: string
          }
          const label = humanizeToolPartType(generic.type)
          const state = generic.state

          if (state === "input-streaming" || state === "input-available") {
            return (
              <div
                key={`${message.id}-${index}`}
                className="flex max-w-full items-center gap-2.5 rounded-full border border-border/30 bg-foreground/[0.03] px-3.5 py-2 text-[13px] text-muted-foreground"
              >
                <CircleNotch className="h-3.5 w-3.5 shrink-0 animate-spin opacity-80" aria-hidden />
                <span className="min-w-0 leading-snug">
                  <span className="text-foreground/90">{label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground/85">Runningâ€¦</span>
                </span>
              </div>
            )
          }

          if (state === "output-error") {
            return (
              <div
                key={`${message.id}-${index}`}
                className="flex max-w-full flex-col gap-1 rounded-2xl border border-destructive/25 px-3.5 py-2 text-[13px]"
              >
                <span className="font-medium text-destructive">{label}</span>
                <span className="text-destructive/90">{generic.errorText || "Something went wrong."}</span>
              </div>
            )
          }

          if (state === "output-available") {
            const messageText =
              typeof generic.output?.message === "string" && generic.output.message.trim().length > 0
                ? generic.output.message.trim()
                : "Done."
            return (
              <div
                key={`${message.id}-${index}`}
                className="flex max-w-full flex-col gap-1 rounded-2xl border border-border/30 bg-foreground/[0.03] px-3.5 py-2 text-[13px] text-foreground/90"
              >
                <span className="font-medium text-foreground/95">{label}</span>
                <span className="leading-snug text-muted-foreground">{messageText}</span>
              </div>
            )
          }
        }

        return null
      })}
    </>
  )
}

