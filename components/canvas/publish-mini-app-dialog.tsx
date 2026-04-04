"use client"

import * as React from "react"
import { useReactFlow, type Edge, type Node } from "@xyflow/react"
import { LinkSimple, RocketLaunch, Sparkle } from "@phosphor-icons/react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Workflow } from "@/lib/workflows/database-server"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { extractGroupAsWorkflow, captureWorkflowScreenshot, dataUrlToFile } from "@/lib/workflows/utils"
import {
  buildMiniAppSlug,
  deriveMiniAppDraft,
  getMiniAppVisibleNodes,
} from "@/lib/mini-apps/heuristics"
import {
  createMiniAppClient,
  fetchMiniAppByWorkflowId,
  updateMiniAppClient,
} from "@/lib/mini-apps/client"
import type {
  MiniApp,
  MiniAppNodeConfig,
  MiniAppNodeConfigMap,
} from "@/lib/mini-apps/types"

interface PublishMiniAppDialogProps {
  groupId?: string | null
  workflow?: Workflow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPublished?: (miniApp: MiniApp) => void
}

function getNodeLabel(node: Node): string {
  const data = (node.data ?? {}) as Record<string, unknown>
  if (typeof data.label === "string" && data.label.trim().length > 0) {
    return data.label.trim()
  }
  return node.type ?? "Node"
}

export function PublishMiniAppDialog({
  groupId = null,
  workflow = null,
  open,
  onOpenChange,
  onPublished,
}: PublishMiniAppDialogProps) {
  const reactFlowInstance = useReactFlow()
  const [loading, setLoading] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)
  const [existingMiniAppId, setExistingMiniAppId] = React.useState<string | null>(null)
  const [snapshotNodes, setSnapshotNodes] = React.useState<Node[]>([])
  const [snapshotEdges, setSnapshotEdges] = React.useState<Edge[]>([])
  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string | null>(null)
  const [thumbnailFile, setThumbnailFile] = React.useState<File | null>(null)
  const [featuredOutputNodeId, setFeaturedOutputNodeId] = React.useState<string | null>(null)
  const [nodeConfig, setNodeConfig] = React.useState<MiniAppNodeConfigMap>({})
  const [slugTouched, setSlugTouched] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const previewUrlRef = React.useRef<string | null>(null)

  const loadDraft = React.useCallback(async () => {
    setLoading(true)

    try {
      let nodes: Node[] = []
      let edges: Edge[] = []
      let draftThumbnailUrl: string | null = null
      let workflowName = workflow?.name ?? ""
      let workflowDescription = workflow?.description ?? ""
      let existingMiniApp: MiniApp | null = null

      if (workflow) {
        nodes = workflow.nodes
        edges = workflow.edges
        draftThumbnailUrl = workflow.thumbnail_url
        existingMiniApp = await fetchMiniAppByWorkflowId(workflow.id)
      } else if (groupId) {
        const allNodes = reactFlowInstance.getNodes()
        const allEdges = reactFlowInstance.getEdges()
        const extracted = extractGroupAsWorkflow(groupId, allNodes, allEdges)
        nodes = extracted.nodes
        edges = extracted.edges

        const groupNode = nodes.find((node) => node.id === groupId)
        workflowName = groupNode ? getNodeLabel(groupNode) : "Mini App"
        workflowDescription = ""

        try {
          draftThumbnailUrl = await captureWorkflowScreenshot(groupId, reactFlowInstance)
        } catch (error) {
          console.error("Error capturing mini app screenshot:", error)
        }
      }

      if (nodes.length === 0) {
        throw new Error("No workflow nodes available for mini app publishing")
      }

      setSnapshotNodes(nodes)
      setSnapshotEdges(edges)

      if (existingMiniApp) {
        setExistingMiniAppId(existingMiniApp.id)
        setName(existingMiniApp.name)
        setSlug(existingMiniApp.slug)
        setDescription(existingMiniApp.description ?? "")
        setThumbnailUrl(existingMiniApp.thumbnail_url)
        setThumbnailFile(null)
        setFeaturedOutputNodeId(existingMiniApp.featured_output_node_id)
        setNodeConfig(existingMiniApp.node_config)
        setSlugTouched(true)
        return
      }

      const draft = deriveMiniAppDraft({
        workflowName,
        workflowDescription,
        thumbnailUrl: draftThumbnailUrl,
        nodes,
        edges,
      })

      setExistingMiniAppId(null)
      setName(draft.name)
      setSlug(draft.slug)
      setDescription(draft.description)
      setThumbnailUrl(draft.thumbnail_url)
      setThumbnailFile(null)
      setFeaturedOutputNodeId(draft.featured_output_node_id)
      setNodeConfig(draft.node_config)
      setSlugTouched(false)
    } catch (error) {
      console.error("Error preparing mini app draft:", error)
      toast.error(error instanceof Error ? error.message : "Failed to prepare mini app")
    } finally {
      setLoading(false)
    }
  }, [groupId, reactFlowInstance, workflow])

  React.useEffect(() => {
    if (!open) return
    void loadDraft()
  }, [loadDraft, open])

  React.useEffect(() => {
    if (slugTouched) return
    setSlug(buildMiniAppSlug(name))
  }, [name, slugTouched])

  const visibleInputs = React.useMemo(
    () => getMiniAppVisibleNodes(snapshotNodes, nodeConfig, "input"),
    [nodeConfig, snapshotNodes]
  )
  const visibleOutputs = React.useMemo(
    () => getMiniAppVisibleNodes(snapshotNodes, nodeConfig, "output"),
    [nodeConfig, snapshotNodes]
  )
  const previewPath = `/apps/${slug || "mini-app"}`

  React.useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const handleThumbnailSelect = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB")
      return
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    const previewUrl = URL.createObjectURL(file)
    previewUrlRef.current = previewUrl
    setThumbnailFile(file)
    setThumbnailUrl(previewUrl)
  }, [])

  const handleNodeConfigChange = React.useCallback(
    (nodeId: string, updates: Partial<MiniAppNodeConfig>) => {
      setNodeConfig((current) => ({
        ...current,
        [nodeId]: {
          ...current[nodeId],
          ...updates,
          node_id: nodeId,
        },
      }))
    },
    []
  )

  const ensureWorkflowForPublishing = React.useCallback(async (): Promise<Workflow> => {
    if (workflow) return workflow

    if (!groupId) {
      throw new Error("No workflow source available")
    }

    const createResponse = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || "Mini App Workflow",
        description: description.trim() || null,
        nodes: snapshotNodes,
        edges: snapshotEdges,
        is_public: false,
      }),
    })

    if (!createResponse.ok) {
      const errorBody = await createResponse.json().catch(() => ({}))
      throw new Error(
        typeof errorBody?.error === "string"
          ? errorBody.error
          : "Failed to create workflow for mini app"
      )
    }

    let createdWorkflow = (await createResponse.json()) as Workflow

    if (thumbnailFile || thumbnailUrl?.startsWith("data:")) {
      const formData = new FormData()
      formData.append(
        "file",
        thumbnailFile ?? dataUrlToFile(thumbnailUrl!, `mini-app-${Date.now()}.png`)
      )

      const uploadResponse = await fetch(`/api/workflows/${createdWorkflow.id}/thumbnail`, {
        method: "POST",
        body: formData,
      })

      if (uploadResponse.ok) {
        const uploadPayload = await uploadResponse.json()
        createdWorkflow = uploadPayload.workflow as Workflow
      }
    }

    return createdWorkflow
  }, [description, groupId, name, snapshotEdges, snapshotNodes, thumbnailFile, thumbnailUrl, workflow])

  const handlePublish = async () => {
    if (!name.trim()) {
      toast.error("Please enter a mini app name")
      return
    }

    if (!slug.trim()) {
      toast.error("Please enter a mini app slug")
      return
    }

    if (visibleOutputs.length === 0) {
      toast.error("Mini app needs at least one visible output")
      return
    }

    try {
      setPublishing(true)
      let resolvedWorkflow = await ensureWorkflowForPublishing()

      if (workflow && thumbnailFile) {
        const formData = new FormData()
        formData.append("file", thumbnailFile)

        const uploadResponse = await fetch(`/api/workflows/${workflow.id}/thumbnail`, {
          method: "POST",
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorBody = await uploadResponse.json().catch(() => ({}))
          throw new Error(
            typeof errorBody?.error === "string"
              ? errorBody.error
              : "Failed to upload workflow thumbnail"
          )
        }

        const uploadPayload = await uploadResponse.json()
        resolvedWorkflow = uploadPayload.workflow as Workflow
      }

      const payload = {
        workflow_id: resolvedWorkflow.id,
        workflow_version: resolvedWorkflow.updated_at,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        thumbnail_url: resolvedWorkflow.thumbnail_url,
        status: "published" as const,
        featured_output_node_id: featuredOutputNodeId ?? visibleOutputs[0]?.id ?? null,
        node_config: nodeConfig,
        snapshot_nodes: snapshotNodes,
        snapshot_edges: snapshotEdges,
      }

      const miniApp = existingMiniAppId
        ? await updateMiniAppClient(existingMiniAppId, payload)
        : await createMiniAppClient(payload)

      toast.success(existingMiniAppId ? "Mini app updated" : "Mini app published")
      onOpenChange(false)
      onPublished?.(miniApp)
    } catch (error) {
      console.error("Error publishing mini app:", error)
      toast.error(error instanceof Error ? error.message : "Failed to publish mini app")
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Turn Into Mini App</DialogTitle>
          <DialogDescription>
            We auto-detected inputs and outputs from this workflow. Review the draft, then publish a clean customer-facing app.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-14 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Preparing mini app draft...
          </div>
        ) : (
          <div className="grid gap-5 py-2">
            <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="mini-app-name">Mini App Name</Label>
                  <Input
                    id="mini-app-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Thumbnail Generator"
                    disabled={publishing}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="mini-app-slug">Slug</Label>
                  <Input
                    id="mini-app-slug"
                    value={slug}
                    onChange={(event) => {
                      setSlugTouched(true)
                      setSlug(buildMiniAppSlug(event.target.value))
                    }}
                    placeholder="thumbnail-generator"
                    disabled={publishing}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="mini-app-description">Description</Label>
                  <Textarea
                    id="mini-app-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Create polished thumbnail variations from your references."
                    rows={3}
                    disabled={publishing}
                  />
                </div>

                {(!thumbnailUrl || thumbnailFile) && (
                  <div className="grid gap-2">
                    <Label>Thumbnail</Label>
                    <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
                      <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-900/70">
                        {thumbnailUrl ? (
                          <img
                            src={thumbnailUrl}
                            alt="Mini app thumbnail preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="px-3 text-center text-xs text-zinc-500">
                            No workflow thumbnail yet
                          </span>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleThumbnailSelect}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={publishing}
                        >
                          Upload Thumbnail
                        </Button>
                        <p className="text-xs text-zinc-500">
                          This becomes the workflow thumbnail too, so the mini app showcase always matches the workflow image.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                <div className="rounded-xl border border-white/10 bg-zinc-900/80 p-3">
                  <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                    <Sparkle className="h-3.5 w-3.5" />
                    Draft Summary
                  </div>
                  <div className="space-y-2 text-sm text-zinc-200">
                    <p>
                      <span className="text-zinc-500">Inputs:</span> {visibleInputs.length}
                    </p>
                    <p>
                      <span className="text-zinc-500">Outputs:</span> {visibleOutputs.length}
                    </p>
                    <p className="flex items-center gap-2 break-all text-xs text-zinc-400">
                      <LinkSimple className="h-3.5 w-3.5 shrink-0" />
                      {previewPath}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                      Visible Inputs
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {visibleInputs.length > 0 ? (
                        visibleInputs.map((node) => (
                          <span
                            key={node.id}
                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-200"
                          >
                            {getNodeLabel(node)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-500">No visible inputs detected</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                      Visible Outputs
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {visibleOutputs.length > 0 ? (
                        visibleOutputs.map((node) => (
                          <span
                            key={node.id}
                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-200"
                          >
                            {getNodeLabel(node)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-500">No visible outputs detected</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Accordion type="single" collapsible className="rounded-2xl border border-white/10 px-4">
              <AccordionItem value="advanced" className="border-none">
                <AccordionTrigger className="py-4 text-sm font-medium">
                  Advanced Node Settings
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-3">
                    {snapshotNodes
                      .filter((node) => node.type !== "group")
                      .map((node) => {
                        const config = nodeConfig[node.id]
                        const label = getNodeLabel(node)
                        const isOutput = config?.role === "output"

                        return (
                          <div
                            key={node.id}
                            className="rounded-xl border border-white/10 bg-zinc-950/50 p-3"
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-zinc-100">{label}</p>
                                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                                  {node.type}
                                </p>
                              </div>

                              {isOutput ? (
                                <Button
                                  type="button"
                                  variant={featuredOutputNodeId === node.id ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setFeaturedOutputNodeId(node.id)}
                                  disabled={!config?.show_in_mini_app || !isOutput}
                                >
                                  {featuredOutputNodeId === node.id ? "Featured Output" : "Set Featured"}
                                </Button>
                              ) : null}
                            </div>

                            <div className="grid gap-3 md:grid-cols-4">
                              <div className="grid gap-2">
                                <Label className="text-xs text-zinc-400">Role</Label>
                                <Select
                                  value={config?.role ?? "input"}
                                  onValueChange={(value) =>
                                    handleNodeConfigChange(node.id, {
                                      role: value as "input" | "output",
                                      user_can_edit:
                                        value === "output"
                                          ? false
                                          : (nodeConfig[node.id]?.user_can_edit ?? true),
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="input">Input</SelectItem>
                                    <SelectItem value="output">Output</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5">
                                <div>
                                  <p className="text-xs font-medium text-zinc-200">Show in mini app</p>
                                </div>
                                <Switch
                                  checked={config?.show_in_mini_app ?? false}
                                  onCheckedChange={(checked) =>
                                    handleNodeConfigChange(node.id, { show_in_mini_app: checked })
                                  }
                                />
                              </div>

                              <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5">
                                <div>
                                  <p className="text-xs font-medium text-zinc-200">User can edit</p>
                                </div>
                                <Switch
                                  checked={config?.user_can_edit ?? false}
                                  onCheckedChange={(checked) =>
                                    handleNodeConfigChange(node.id, { user_can_edit: checked })
                                  }
                                  disabled={(nodeConfig[node.id]?.role ?? "input") === "output"}
                                />
                              </div>

                              <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5">
                                <div>
                                  <p className="text-xs font-medium text-zinc-200">Required</p>
                                </div>
                                <Switch
                                  checked={config?.required ?? false}
                                  onCheckedChange={(checked) =>
                                    handleNodeConfigChange(node.id, { required: checked })
                                  }
                                  disabled={(nodeConfig[node.id]?.role ?? "input") === "output"}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={loading || publishing}>
            {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RocketLaunch className="mr-2 h-4 w-4" />}
            {existingMiniAppId ? "Update Mini App" : "Publish Mini App"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
