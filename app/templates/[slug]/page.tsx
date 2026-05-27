import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { TemplateRunForm } from "@/components/templates/template-run-form"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { getTemplateBySlugForUser } from "@/lib/templates/database-server"

interface TemplateRunPageProps {
  params: Promise<{ slug: string }>
}

export default async function TemplateRunPage({ params }: TemplateRunPageProps) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const template = await getTemplateBySlugForUser(slug, user?.id ?? null)
  if (!template) {
    notFound()
  }

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/templates/${slug}`)}`)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-lg px-4 pb-8 pt-[60px] sm:pb-12">
        <div className="relative mb-8 space-y-4 text-center">
          <Button
            asChild
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-0 top-0 rounded-full"
          >
            <Link href="/templates" aria-label="Back to templates">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>

          {template.thumbnail_url ? (
            <div className="mx-auto size-16 overflow-hidden rounded-2xl bg-muted sm:size-32">
              {template.thumbnail_kind === "video" ? (
                <video
                  src={template.thumbnail_url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  loop
                  autoPlay
                />
              ) : (
                <img
                  src={template.thumbnail_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          ) : (
            <div className="mx-auto size-16 rounded-2xl bg-muted sm:size-32" />
          )}

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{template.title}</h1>
            {template.description ? (
              <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
            ) : null}
          </div>

          {template.tips ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left text-sm text-emerald-800 dark:text-emerald-200">
              <span className="mr-1 font-semibold uppercase tracking-wide">Tip:</span>
              {template.tips}
            </div>
          ) : null}

        </div>

        <TemplateRunForm template={template} />

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <p className="text-center text-xs text-muted-foreground">
            Nudity/suggestive content is not supported and will be blocked.
          </p>
          <Badge variant="secondary" className="text-xs font-normal">
            Cost: {template.credits_cost} credits
          </Badge>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/templates"
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Browse more templates -&gt;
          </Link>
        </div>
      </div>
    </main>
  )
}
