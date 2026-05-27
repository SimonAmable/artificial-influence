import { notFound, redirect } from "next/navigation"
import { TemplateEditor } from "@/components/templates/template-editor"
import { createClient } from "@/lib/supabase/server"
import { getTemplateById } from "@/lib/templates/database-server"

interface EditTemplatePageProps {
  params: Promise<{ id: string }>
}

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/templates/edit/${id}`)
  }

  const template = await getTemplateById(id, user.id)
  if (!template || template.creator_id !== user.id) {
    notFound()
  }

  return <TemplateEditor initial={template} />
}
