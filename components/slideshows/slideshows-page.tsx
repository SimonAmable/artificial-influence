"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowsOutSimple,
  CircleNotch,
  Copy,
  PencilSimple,
  Plus,
  Sparkle,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { SlideshowCollection } from "@/lib/slideshow/types"
import { ProjectEditor } from "@/components/slideshows/project-editor"
import { projectPreviewImage } from "@/components/slideshows/slide-preview-frame"
import { SlideshowFullscreenViewer } from "@/components/slideshows/slideshow-fullscreen-viewer"
import { TemplatePreviewModal } from "@/components/slideshows/template-preview-modal"
import { TemplateSlideThumb } from "@/components/slideshows/template-slide-thumb"
import type {
  SlideshowAspectRatio,
  SlideshowProject,
  SlideshowTemplate,
} from "@/lib/slideshows/types"

type Tab = "projects" | "templates" | "collections"

function statusVariant(status: SlideshowProject["status"]) {
  return status === "rendered" || status === "ready" ? "default" : status === "failed" ? "destructive" : "secondary"
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || "Request failed.")
  return body as T
}

function CreateSlideshowDialog({
  open,
  onOpenChange,
  templates,
  initialTemplateId,
  lockedTemplateId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: SlideshowTemplate[]
  initialTemplateId: string | null
  lockedTemplateId?: string | null
  onCreated: (project: SlideshowProject) => void
}) {
  const [brief, setBrief] = React.useState("")
  const [templateId, setTemplateId] = React.useState(initialTemplateId ?? "none")
  const [aspectRatio, setAspectRatio] = React.useState<SlideshowAspectRatio>("9:16")
  const [slideCount, setSlideCount] = React.useState("5")
  const [busy, setBusy] = React.useState(false)
  const templateLocked = Boolean(lockedTemplateId)

  React.useEffect(() => {
    if (!open) return
    setTemplateId(lockedTemplateId ?? initialTemplateId ?? "none")
    const locked = lockedTemplateId
      ? templates.find((template) => template.id === lockedTemplateId)
      : null
    if (locked) setAspectRatio(locked.aspectRatio)
  }, [initialTemplateId, lockedTemplateId, open, templates])

  async function create() {
    if (brief.trim().length < 4) {
      toast.error("Describe the slideshow you want to create.")
      return
    }
    setBusy(true)
    try {
      const { project } = await readJson<{ project: SlideshowProject }>(await fetch("/api/slideshows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          templateId: templateId === "none" ? undefined : templateId,
          aspectRatio,
          slideCount: templateId === "none" ? Number(slideCount) : undefined,
        }),
      }))
      onCreated(project)
      onOpenChange(false)
      setBrief("")
      toast.success("Slideshow draft created.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create slideshow.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create slideshow</DialogTitle>
          <DialogDescription>
            Describe the result for this run. Use a saved template when you already know the slide structure.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/slideshows/templates/new">Build structure</Link>
          </Button>
        </div>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Creative brief</Label>
            <Textarea
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              rows={7}
              placeholder="Create a five-slide slideshow with fresh productivity advice. Use my faceless UGC collection, edit each image to match the advice, and make the first slide a strong hook."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>Start from template</Label>
              <Select
                value={templateId}
                onValueChange={setTemplateId}
                disabled={templateLocked}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Let AI create a reusable template</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Aspect ratio</Label>
              <Select value={aspectRatio} onValueChange={(value) => setAspectRatio(value as SlideshowAspectRatio)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16</SelectItem>
                  <SelectItem value="4:5">4:5</SelectItem>
                  <SelectItem value="1:1">1:1</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {templateId === "none" ? (
            <div className="max-w-32 space-y-2">
              <Label>Slides</Label>
              <Input type="number" min={1} max={35} value={slideCount} onChange={(event) => setSlideCount(event.target.value)} />
            </div>
          ) : null}
          <Button className="w-full" size="lg" disabled={busy} onClick={() => void create()}>
            {busy ? <CircleNotch className="mr-2 h-4 w-4 animate-spin" /> : <Sparkle className="mr-2 h-4 w-4" />}
            {busy ? "Creating editable draft..." : "Create editable draft"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SlideshowsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = React.useState<Tab>("projects")
  const [projects, setProjects] = React.useState<SlideshowProject[]>([])
  const [templates, setTemplates] = React.useState<SlideshowTemplate[]>([])
  const [collections, setCollections] = React.useState<SlideshowCollection[]>([])
  const [loading, setLoading] = React.useState(true)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [initialTemplateId, setInitialTemplateId] = React.useState<string | null>(null)
  const [selectedProject, setSelectedProject] = React.useState<SlideshowProject | null>(null)
  const [collectionName, setCollectionName] = React.useState("")
  const [previewTemplate, setPreviewTemplate] = React.useState<SlideshowTemplate | null>(null)
  const [lockedCreateTemplateId, setLockedCreateTemplateId] = React.useState<string | null>(null)
  const [fullscreenProject, setFullscreenProject] = React.useState<SlideshowProject | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [projectData, templateData, collectionData] = await Promise.all([
        readJson<{ projects: SlideshowProject[] }>(await fetch("/api/slideshows", { cache: "no-store" })),
        readJson<{ templates: SlideshowTemplate[] }>(await fetch("/api/slideshows/templates", { cache: "no-store" })),
        readJson<{ collections: SlideshowCollection[] }>(await fetch("/api/slideshows/collections", { cache: "no-store" })),
      ])
      setProjects(projectData.projects)
      setTemplates(templateData.templates)
      setCollections(collectionData.collections)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load slideshows.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void load() }, [load])
  React.useEffect(() => {
    const projectId = searchParams.get("project")
    if (!projectId || projects.length === 0 || selectedProject) return
    const match = projects.find((project) => project.id === projectId)
    if (match) setSelectedProject(match)
  }, [projects, searchParams, selectedProject])

  React.useEffect(() => {
    const requestedTab = searchParams.get("tab")
    if (requestedTab === "projects" || requestedTab === "templates" || requestedTab === "collections") {
      setTab(requestedTab)
    }
  }, [searchParams])

  React.useEffect(() => {
    if (searchParams.get("create") !== "1") return
    const templateId = searchParams.get("templateId")
    setCreateOpen(true)
    if (templateId) {
      setLockedCreateTemplateId(templateId)
      setInitialTemplateId(templateId)
    }
  }, [searchParams])

  function upsertProject(project: SlideshowProject) {
    setProjects((current) => [project, ...current.filter((candidate) => candidate.id !== project.id)])
    setSelectedProject(project)
  }

  async function cloneTemplate(template: SlideshowTemplate) {
    try {
      const { template: cloned } = await readJson<{ template: SlideshowTemplate }>(await fetch("/api/slideshows/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      }))
      setTemplates((current) => [cloned, ...current])
      toast.success("Template cloned.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clone template.")
    }
  }

  async function createCollection() {
    if (!collectionName.trim()) return
    try {
      const { collection } = await readJson<{ collection: SlideshowCollection }>(await fetch("/api/slideshows/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: collectionName }),
      }))
      setCollections((current) => [collection, ...current])
      setCollectionName("")
      toast.success("Collection created.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create collection.")
    }
  }

  if (selectedProject) {
    return (
      <ProjectEditor
        project={selectedProject}
        onBack={() => setSelectedProject(null)}
        onChange={upsertProject}
        onRunAgain={() => {
          setInitialTemplateId(selectedProject.templateId)
          setSelectedProject(null)
          setCreateOpen(true)
        }}
      />
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Create repeatable content</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Slideshows</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Mix curated collections, AI-generated graphics, AI edits, and editable overlays in reusable slideshow templates.
            </p>
          </div>
          <Button size="lg" onClick={() => { setInitialTemplateId(null); setCreateOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />Create slideshow
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-6">
            {loading ? <p className="text-sm text-muted-foreground">Loading projects...</p> : projects.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-16 text-center">
                  <Sparkle className="mb-4 h-8 w-8 text-muted-foreground" />
                  <h2 className="font-medium">Create your first reusable slideshow</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">Describe a format once, then rerun it with fresh content and visuals.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => {
                  const cover = projectPreviewImage(project)
                  return (
                    <Card key={project.id} className="overflow-hidden transition hover:border-foreground/25">
                      <div className="relative">
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() => setSelectedProject(project)}
                        >
                          <div className="aspect-[9/16] w-full bg-muted">
                            {cover ? (
                              <img src={cover} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                No preview yet
                              </div>
                            )}
                          </div>
                        </button>
                        <Badge className="absolute left-3 top-3" variant="secondary">
                          {project.slides.length} slides
                        </Badge>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="absolute right-3 top-3 h-8 w-8 rounded-full bg-background/90 shadow-sm"
                          onClick={() => setFullscreenProject(project)}
                        >
                          <ArrowsOutSimple className="h-4 w-4" />
                        </Button>
                      </div>
                      <button
                        type="button"
                        className="w-full px-5 py-4 text-left"
                        onClick={() => setSelectedProject(project)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="line-clamp-1 text-base">{project.name}</CardTitle>
                          <Badge variant={statusVariant(project.status)}>{project.status}</Badge>
                        </div>
                        <CardDescription className="mt-2 line-clamp-2">{project.brief}</CardDescription>
                      </button>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <div className="mb-5 flex justify-end">
              <Button asChild>
                <Link href="/slideshows/templates/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New template
                </Link>
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setPreviewTemplate(template)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <Badge variant="secondary">{template.origin}</Badge>
                      </div>
                      <CardDescription>
                        {template.description || `${template.blueprint.slides.length}-slide reusable template`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-2 overflow-hidden pb-4">
                      {template.blueprint.slides.slice(0, 5).map((slide, index) => (
                        <TemplateSlideThumb key={slide.id} slide={slide} index={index} />
                      ))}
                    </CardContent>
                  </button>
                  <CardContent className="flex gap-2 border-t pt-4">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setLockedCreateTemplateId(template.id)
                        setInitialTemplateId(template.id)
                        setCreateOpen(true)
                      }}
                    >
                      <Sparkle className="mr-2 h-4 w-4" />
                      Run template
                    </Button>
                    <Button variant="outline" size="icon" asChild>
                      <Link href={`/slideshows/templates/${template.id}/edit`}>
                        <PencilSimple className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => void cloneTemplate(template)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="collections" className="mt-6">
            <div className="mb-5 flex max-w-xl gap-2">
              <Input value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder="New collection name" />
              <Button onClick={() => void createCollection()}>Create</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {collections.map((collection) => (
                <Card key={collection.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{collection.name}</CardTitle>
                    <CardDescription>{collection.items.length} images · {collection.description || "Reusable visual collection"}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2 overflow-hidden">
                    {collection.items.slice(0, 6).map((item) => (
                      <img key={item.id} src={item.thumbnailUrl || item.url} alt="" className="aspect-square w-14 rounded-md object-cover" />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <CreateSlideshowDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            setLockedCreateTemplateId(null)
            if (searchParams.get("create")) {
              router.replace("/slideshows")
            }
          }
        }}
        templates={templates}
        initialTemplateId={initialTemplateId}
        lockedTemplateId={lockedCreateTemplateId}
        onCreated={upsertProject}
      />

      <SlideshowFullscreenViewer
        project={fullscreenProject}
        open={Boolean(fullscreenProject)}
        onOpenChange={(open) => {
          if (!open) setFullscreenProject(null)
        }}
        onEdit={fullscreenProject ? () => {
          setSelectedProject(fullscreenProject)
          setFullscreenProject(null)
        } : undefined}
      />

      <TemplatePreviewModal
        template={previewTemplate}
        open={Boolean(previewTemplate)}
        onOpenChange={(open) => {
          if (!open) setPreviewTemplate(null)
        }}
        onUseTemplate={(template) => {
          setPreviewTemplate(null)
          setLockedCreateTemplateId(template.id)
          setInitialTemplateId(template.id)
          setCreateOpen(true)
        }}
      />
    </main>
  )
}
