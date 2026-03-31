"use client"

import { useParams } from "next/navigation"
import { ProjectEditor } from "@/components/editor/project-editor"

export default function EditorProjectPage() {
  const params = useParams()
  return <ProjectEditor projectId={params.id as string} />
}
