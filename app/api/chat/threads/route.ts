import { createClient } from "@/lib/supabase/server"
import { createChatThread, listUserChatThreads } from "@/lib/chat/database-server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const threads = await listUserChatThreads(user.id)

    return Response.json({
      threads,
    })
  } catch (error) {
    console.error("[chat/threads] Error listing threads:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to list chat threads",
      }),
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const title = typeof body?.title === "string" ? body.title : undefined
    const thread = await createChatThread(user.id, title)

    return Response.json({
      thread: {
        id: thread.id,
        title: thread.title,
      },
    })
  } catch (error) {
    console.error("[chat/threads] Error creating thread:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to create chat thread",
      }),
      { status: 500 },
    )
  }
}
