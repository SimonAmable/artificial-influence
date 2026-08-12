import type { Metadata } from "next"

import { MetadataRemoverTool } from "@/components/tools/metadata-remover"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Metadata Remover",
  description: "Strip metadata for free. Add SynthID scrub for Google AI images.",
}

export default async function MetadataRemoverPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let autoStripImageMetadata = false
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("auto_strip_image_metadata")
      .eq("id", user.id)
      .maybeSingle()
    autoStripImageMetadata = profile?.auto_strip_image_metadata === true
  }

  return (
    <MetadataRemoverTool
      autoStripImageMetadata={autoStripImageMetadata}
      isSignedIn={!!user}
    />
  )
}
