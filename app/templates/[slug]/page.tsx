import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { TemplateRunForm } from "@/components/templates/template-run-form"
import { Button } from "@/components/ui/button"
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
      <div className="mx-auto w-full max-w-lg px-4 pb-8 pt-[60px] sm:pb-12 lg:max-w-6xl lg:px-8">
        <div className="mb-4 hidden lg:block">
          <Button asChild type="button" variant="ghost" size="icon" className="rounded-full">
            <Link href="/templates" aria-label="Back to templates">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
          <div className="order-2 lg:order-1">
            <TemplateRunForm template={template} compactDesktop />

            <p className="mt-4 text-center text-xs text-muted-foreground lg:text-left">
              Nudity/suggestive content is not supported and will be blocked.
            </p>

            <div className="mt-8 text-center lg:hidden">
              <Link
                href="/templates"
                className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Browse more templates -&gt;
              </Link>
            </div>
          </div>

          <div className="order-1 mb-8 space-y-4 text-center lg:order-2 lg:mb-0 lg:space-y-5 lg:text-left">
            <div className="flex items-start gap-3 lg:block">
              <Button
                asChild
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full lg:hidden"
              >
                <Link href="/templates" aria-label="Back to templates">
                  <ArrowLeft className="size-5" />
                </Link>
              </Button>

              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
                  {template.title}
                </h1>
                {template.description ? (
                  <p className="mt-2 text-sm text-muted-foreground lg:max-w-2xl lg:text-base">
                    {template.description}
                  </p>
                ) : null}
              </div>
            </div>

            {template.thumbnail_url ? (
              <div className="flex justify-center">
                {template.thumbnail_kind === "video" ? (
                  <video
                    src={template.thumbnail_url}
                    className="block max-h-[min(25vh,210px)] max-w-full rounded-2xl object-contain sm:max-h-[min(52vh,540px)]"
                    muted
                    playsInline
                    loop
                    autoPlay
                  />
                ) : (
                  <img
                    src={template.thumbnail_url}
                    alt=""
                    className="block max-h-[min(25vh,210px)] max-w-full rounded-2xl object-contain sm:max-h-[min(52vh,540px)]"
                  />
                )}
              </div>
            ) : null}

            {template.tips ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left text-sm text-emerald-800 dark:text-emerald-200">
                <span className="mr-1 font-semibold uppercase tracking-wide">Tip:</span>
                {template.tips}
              </div>
            ) : null}

            <div className="hidden text-center lg:block">
              <Link
                href="/templates"
                className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Browse more templates -&gt;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
