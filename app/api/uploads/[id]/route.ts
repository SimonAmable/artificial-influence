import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const { id: uploadId } = await params

    const { data: upload, error: fetchError } = await supabase
      .from("uploads")
      .select("id, bucket, storage_path")
      .eq("id", uploadId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !upload) {
      return NextResponse.json({ error: "Upload not found or unauthorized" }, { status: 404 })
    }

    if (upload.storage_path) {
      const { error: storageError } = await supabase.storage
        .from(upload.bucket || "public-bucket")
        .remove([upload.storage_path])

      if (storageError) {
        console.error("[uploads] Error deleting file from storage:", storageError)
      }
    }

    const { error: deleteError } = await supabase
      .from("uploads")
      .delete()
      .eq("id", uploadId)
      .eq("user_id", user.id)

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete upload", message: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Upload deleted successfully",
    })
  } catch (error) {
    console.error("[uploads] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
