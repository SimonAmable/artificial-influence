"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Stack } from "@phosphor-icons/react"
import { FeatureShowcaseCarousel } from "@/components/dashboard/feature-showcase-carousel"
import { FeatureButtonGrid } from "@/components/dashboard/feature-button-grid"
import type { Workflow } from "@/lib/workflows/database-server"

export function DashboardPage() {
  return (
    <div className="min-h-screen bg-background px-4 md:px-20">
      {/* Hero Section with Carousel */}
      <section className="mx-auto w-full pt-20">
        <FeatureShowcaseCarousel />
      </section>

      {/* Tools Section */}
      <section className="mx-auto w-full  py-10">
        <FeatureButtonGrid />
      </section>

      {/* Workflows Section */}
      {/* <WorkflowsSection /> */}
    </div>
  )
}

function WorkflowsSection() {
  const [workflows, setWorkflows] = React.useState<Workflow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let isMounted = true

    const fetchWorkflows = async () => {
      try {
        const response = await fetch("/api/workflows")
        if (!response.ok) {
          throw new Error("Failed to fetch workflows")
        }

        const data = (await response.json()) as Workflow[]
        if (isMounted) {
          setWorkflows(data)
        }
      } catch (error) {
        console.error("Failed to load workflows", error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchWorkflows()

    return () => {
      isMounted = false
    }
  }, [])

  const visibleWorkflows = workflows.slice(0, 6)

  return (
    <section className="mx-auto w-full  pb-16 pt-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-semibold">Workflow</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/canvases">View all</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={`workflow-skeleton-${index}`}
                className="animate-pulse border border-white/5 bg-muted/30"
              >
                <div className="h-40 w-full bg-muted/50" />
                <div className="space-y-2 px-5 pb-5 pt-4">
                  <div className="h-3 w-3/4 rounded-full bg-muted/60" />
                  <div className="h-3 w-1/2 rounded-full bg-muted/60" />
                </div>
              </Card>
            ))
          : visibleWorkflows.map((workflow) => (
              <Link
                key={workflow.id}
                href="/canvases"
                className="group"
              >
                <Card className="h-full border border-white/5 bg-muted/20 transition group-hover:border-primary/30">
                  <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-muted/40">
                    {workflow.thumbnail_url ? (
                      <Image
                        src={workflow.thumbnail_url}
                        alt={workflow.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Stack size={32} weight="thin" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                  </div>
                  <div className="px-5 pb-5 pt-4">
                    <p className="text-sm font-medium">{workflow.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {workflow.is_public ? "Public workflow" : "Private workflow"}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
      </div>
    </section>
  )
}
