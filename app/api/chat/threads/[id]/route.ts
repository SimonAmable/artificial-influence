import { createClient } from "@/lib/supabase/server"
import { getChatThreadById } from "@/lib/chat/database-server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const thread = await getChatThreadById(id, user.id)

    if (!thread) {
      return new Response(JSON.stringify({ error: "Chat thread not found" }), { status: 404 })
    }

    return Response.json({
      thread: {
        id: thread.id,
        messages: thread.messages,
        title: thread.title,
        updatedAt: thread.updated_at,
      },
    })
  } catch (error) {
    console.error("[chat/threads/:id] Error loading thread:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to load chat thread",
      }),
      { status: 500 },
    )
  }
}
