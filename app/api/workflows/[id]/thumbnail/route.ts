import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { uploadWorkflowThumbnail, updateWorkflow } from "@/lib/workflows/database-server"

/**
 * POST /api/workflows/[id]/thumbnail
 * Upload a thumbnail image for a workflow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Upload thumbnail to storage
    const thumbnailUrl = await uploadWorkflowThumbnail(user.id, id, file)

    // Update workflow with new thumbnail URL
    const workflow = await updateWorkflow(id, user.id, {
      thumbnail_url: thumbnailUrl,
    })

    return NextResponse.json({ thumbnail_url: thumbnailUrl, workflow })
  } catch (error) {
    console.error("Error uploading workflow thumbnail:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload thumbnail" },
      { status: 500 }
    )
  }
}
