import { redirect } from "next/navigation"
import { TemplateEditor } from "@/components/templates/template-editor"
import { createClient } from "@/lib/supabase/server"

export const metadata = {
  title: "Create template",
}

export default async function NewTemplatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?next=/templates/new")
  }

  return <TemplateEditor />
}
