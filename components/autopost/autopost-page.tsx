"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, CalendarClock, Link2, ShieldCheck, Upload, UserRound } from "lucide-react"
import { toast } from "sonner"

import { ensureJpegForInstagramFeed } from "@/lib/autopost/convert-image-for-instagram"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const AUTOPOST_MEDIA_FOLDER = "autopost-drafts"

function inferDraftMediaType(file: File): "image" | "reel" | null {
  if (file.type.startsWith("image/")) {
    return "image"
  }
  if (file.type.startsWith("video/")) {
    return "reel"
  }
  return null
}

type InstagramConnectionStatus = {
  connected: boolean
  connection?: {
    instagramUsername: string | null
    instagramUserId: string | null
    accountType: string | null
    provider: string | null
    tokenExpiresAt: string | null
    updatedAt: string
  }
}

export function AutopostPage() {
  const [status, setStatus] = React.useState<InstagramConnectionStatus | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = React.useState(true)
  const [isDisconnecting, setIsDisconnecting] = React.useState(false)
  const [caption, setCaption] = React.useState("")
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [isPostingDraft, setIsPostingDraft] = React.useState(false)
  const [disconnectDialogOpen, setDisconnectDialogOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()
  const hasHandledAuthParams = React.useRef(false)

  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const fetchStatus = React.useCallback(async () => {
    setIsLoadingStatus(true)
    try {
      const response = await fetch("/api/instagram/status", { cache: "no-store" })
      const data = (await response.json()) as InstagramConnectionStatus | { error?: string }

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Failed to load Instagram connection status.")
      }

      setStatus(data as InstagramConnectionStatus)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load Instagram status")
      setStatus({ connected: false })
    } finally {
      setIsLoadingStatus(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  React.useEffect(() => {
    if (hasHandledAuthParams.current) {
      return
    }

    const error = searchParams.get("error")
    const connected = searchParams.get("connected")

    if (!error && !connected) {
      return
    }

    hasHandledAuthParams.current = true

    if (error) {
      toast.error(error)
    } else if (connected === "1") {
      toast.success("Instagram account connected.")
      void fetchStatus()
    }

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.delete("error")
    nextUrl.searchParams.delete("connected")
    const search = nextUrl.searchParams.toString()
    window.history.replaceState({}, "", search ? `${nextUrl.pathname}?${search}` : nextUrl.pathname)
  }, [fetchStatus, searchParams])

  const handleConnect = () => {
    window.location.href = "/api/instagram/connect"
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      const response = await fetch("/api/instagram/disconnect", { method: "POST" })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to disconnect Instagram account.")
      }
      toast.success("Instagram account disconnected.")
      setDisconnectDialogOpen(false)
      await fetchStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect Instagram account")
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleMediaFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) {
      setSelectedFile(null)
      setPreviewUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous)
        }
        return null
      })
      return
    }

    if (!inferDraftMediaType(file)) {
      toast.error("Use an image (JPEG, PNG, WebP, GIF) or a video (MP4, MOV).")
      event.target.value = ""
      return
    }

    setPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return URL.createObjectURL(file)
    })
    setSelectedFile(file)
  }

  const handlePostDraft = async () => {
    if (!selectedFile) {
      toast.error("Choose a media file first.")
      return
    }

    if (!status?.connected) {
      toast.error("Connect Instagram before publishing.")
      return
    }

    const mediaType = inferDraftMediaType(selectedFile)
    if (!mediaType) {
      toast.error("Unsupported media type.")
      return
    }

    setIsPostingDraft(true)
    try {
      let fileToUpload: File = selectedFile
      if (mediaType === "image") {
        try {
          fileToUpload = await ensureJpegForInstagramFeed(selectedFile)
        } catch (conversionError) {
          toast.error(
            conversionError instanceof Error ? conversionError.message : "Could not convert image to JPEG."
          )
          return
        }
      }

      const uploaded = await uploadFileToSupabase(fileToUpload, AUTOPOST_MEDIA_FOLDER)
      if (!uploaded) {
        return
      }

      const draftResponse = await fetch("/api/autopost/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl: uploaded.url,
          caption,
          mediaType,
        }),
      })

      const draftData = (await draftResponse.json()) as { error?: string; draft?: { id: string } }

      if (!draftResponse.ok) {
        throw new Error(draftData.error || "Failed to save draft.")
      }

      const jobId = draftData.draft?.id
      if (!jobId) {
        throw new Error("Draft saved but missing job id.")
      }

      if (mediaType === "reel") {
        toast.message("Publishing reel…", {
          description: "Instagram may take up to a few minutes to process the video.",
        })
      }

      const publishResponse = await fetch("/api/autopost/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      })

      const publishData = (await publishResponse.json()) as { error?: string; instagramMediaId?: string }

      if (!publishResponse.ok) {
        throw new Error(publishData.error || "Instagram publishing failed.")
      }

      toast.success("Published to Instagram.")
      setCaption("")
      setSelectedFile(null)
      setPreviewUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous)
        }
        return null
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed")
    } finally {
      setIsPostingDraft(false)
    }
  }

  const connection = status?.connection
  const isConnected = Boolean(status?.connected)

  return (
    <div className="min-h-screen bg-background px-4 pb-6 pt-20 md:pt-24">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Autopost</h1>
          <p className="text-sm text-muted-foreground">
            Connect Instagram, draft content, and prepare scheduled publishing workflows.
          </p>
        </div>

        <Card className="py-4 sm:py-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Instagram Connection
            </CardTitle>
            <CardDescription>
              Connect with Instagram Login. Publishing uses the Content Publishing API on graph.instagram.com.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingStatus ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading connection status...
              </div>
            ) : (
              <div className="space-y-3">
                <Badge variant={isConnected ? "default" : "outline"}>
                  {isConnected ? "Connected" : "Not connected"}
                </Badge>
                {isConnected ? (
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                      <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
                      <span>Linked Instagram account</span>
                      <Badge variant="secondary" className="ml-auto text-xs font-normal">
                        Active
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
                        <p className="text-xs font-medium text-muted-foreground">Username</p>
                        <p className="mt-0.5 text-sm text-foreground">{connection?.instagramUsername || "Unknown"}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
                        <p className="text-xs font-medium text-muted-foreground">Instagram ID</p>
                        <p className="mt-0.5 break-all text-sm text-foreground">
                          {connection?.instagramUserId || "Unknown"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
                        <p className="text-xs font-medium text-muted-foreground">Account type</p>
                        <p className="mt-0.5 text-sm text-foreground">{connection?.accountType || "Unknown"}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
                        <p className="text-xs font-medium text-muted-foreground">Token expires</p>
                        <p className="mt-0.5 text-sm text-foreground">
                          {connection?.tokenExpiresAt
                            ? new Date(connection.tokenExpiresAt).toLocaleString()
                            : "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">No account linked</p>
                    <p className="mt-1">Connect an Instagram professional account to continue.</p>
                    <p className="mt-2 text-xs">
                      Business and Creator accounts are supported. A Facebook Page link is not required.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={handleConnect}>Connect Instagram</Button>
            <Button
              variant="outline"
              onClick={() => setDisconnectDialogOpen(true)}
              disabled={!isConnected || isDisconnecting}
            >
              Disconnect
            </Button>
          </CardFooter>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="py-4 sm:py-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Draft Composer
              </CardTitle>
              <CardDescription>
                Images are converted to JPEG before upload for Instagram feed rules. Use MP4/MOV for reels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="autopost-media">Media</Label>
                <Input
                  id="autopost-media"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="cursor-pointer"
                  onChange={handleMediaFileChange}
                />
                <p className="text-xs text-muted-foreground">
                  PNG/WebP/GIF are converted to JPEG (transparent areas become white). Public URL for Instagram (
                  <span className="text-foreground/80">max 10 MB</span> upload).
                </p>
              </div>

              {previewUrl && selectedFile?.type.startsWith("image/") ? (
                <div className="overflow-hidden rounded-md border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Selected media preview"
                    className="max-h-48 w-full object-contain"
                    src={previewUrl}
                  />
                </div>
              ) : null}

              {selectedFile && !selectedFile.type.startsWith("image/") ? (
                <p className="text-sm text-muted-foreground">
                  Selected: <span className="text-foreground">{selectedFile.name}</span>
                </p>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="autopost-caption">Caption</Label>
                <Textarea
                  id="autopost-caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="Write your caption..."
                  rows={5}
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                onClick={handlePostDraft}
                disabled={!selectedFile || isPostingDraft || !isConnected}
              >
                {isPostingDraft ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Publish to Instagram
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card className="py-4 sm:py-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Scheduler Preview
              </CardTitle>
              <CardDescription>
                Queue-backed scheduling will activate after worker and publish endpoints are live.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>- Post now and schedule options are part of the next implementation phase.</p>
              <p>- Jobs table and API scaffolding are prepared in this release.</p>
              <p>- Once publish logic ships, this section will display queue status and retries.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog
        open={disconnectDialogOpen}
        onOpenChange={(open) => {
          if (!open && isDisconnecting) {
            return
          }
          setDisconnectDialogOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Instagram?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the link to{" "}
              {connection?.instagramUsername ? (
                <span className="font-medium text-foreground">@{connection.instagramUsername}</span>
              ) : (
                "your Instagram account"
              )}
              . You will need to connect again before publishing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDisconnect()
              }}
              disabled={isDisconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting…
                </>
              ) : (
                "Disconnect"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
