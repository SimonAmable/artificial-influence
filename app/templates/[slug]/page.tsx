import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { TemplateRunForm } from "@/components/templates/template-run-form"
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
        <div className="mb-8 space-y-4 text-center">
          {template.thumbnail_url ? (
            <div className="mx-auto size-16 overflow-hidden rounded-2xl bg-muted">
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
            <div className="mx-auto size-16 rounded-2xl bg-muted" />
          )}

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{template.title}</h1>
            {template.description ? (
              <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
            ) : null}
          </div>

          {template.tips ? (
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-left text-sm text-foreground">
              {template.tips}
            </div>
          ) : null}

        </div>

        <TemplateRunForm template={template} />

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Nudity/suggestive content is not supported and will be blocked.
        </p>

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
