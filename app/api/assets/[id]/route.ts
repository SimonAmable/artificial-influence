import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const assetId = resolvedParams.id

    const { data: asset, error: fetchError } = await supabase
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !asset) {
      return NextResponse.json({ error: "Asset not found or unauthorized" }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from("assets")
      .delete()
      .eq("id", assetId)
      .eq("user_id", user.id)

    if (deleteError) {
      console.error("[assets] DELETE failed:", deleteError)
      return NextResponse.json({ error: "Failed to delete asset", message: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[assets] DELETE exception:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
