import { createGateway, convertToModelMessages, streamText, type UIMessage } from "ai"
import { createClient } from "@/lib/supabase/server"
import { loadEditorProject } from "@/lib/editor/database-server"
import { CHATBOT_SYSTEM_PROMPT, PROMPT_RECREATE_SYSTEM_PROMPT } from "@/lib/constants/system-prompts"

function buildEditorContextPrompt(project: Awaited<ReturnType<typeof loadEditorProject>>) {
  if (!project) {
    return "This is a plain project chat. The project could not be loaded, so answer generally."
  }

  const trackSummary = project.timeline_state.tracks
    .map((track) => `${track.name} (${track.type}): ${track.items.length} items`)
    .join("; ")

  return [
    "This is a plain project-scoped chat for the video editor.",
    "Do not pretend to edit the timeline, queue renders, or execute actions.",
    "You can discuss the project, suggest next edits, explain timelines, and help the user reason about their composition.",
    `Project name: ${project.name}`,
    `Composition: ${project.composition_settings.width}x${project.composition_settings.height}, ${project.composition_settings.fps} fps, ${project.composition_settings.durationInFrames} frames`,
    `Tracks: ${trackSummary || "No tracks yet"}`,
  ].join("\n")
}

export async function POST(req: Request) {
  try {
    if (!process.env.AI_GATEWAY_API_KEY) {
      console.error("[chat] AI_GATEWAY_API_KEY not set")
      return new Response(
        JSON.stringify({ error: "AI_GATEWAY_API_KEY environment variable is not set" }),
        { status: 500 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[chat] Authentication failed:", authError?.message || "No user")
      return new Response(
        JSON.stringify({ error: "Unauthorized. Please log in to use chat." }),
        { status: 401 },
      )
    }

    const body = await req.json()
    const {
      messages,
      mode = "chat",
      model = "google/gemini-2.5-flash",
      projectId,
    }: {
      messages: UIMessage[]
      mode?: "chat" | "prompt-recreate" | "agent"
      model?: string
      projectId?: string
    } = body

    const gateway = createGateway({
      apiKey: process.env.AI_GATEWAY_API_KEY,
    })

    let systemPrompt =
      mode === "prompt-recreate" ? PROMPT_RECREATE_SYSTEM_PROMPT : CHATBOT_SYSTEM_PROMPT

    if (mode === "agent") {
      const project = projectId ? await loadEditorProject(projectId, user.id) : null
      if (projectId && !project) {
        return new Response(JSON.stringify({ error: "Editor project not found" }), {
          status: 404,
        })
      }

      systemPrompt = `${CHATBOT_SYSTEM_PROMPT}

${buildEditorContextPrompt(project)}

Reply conversationally. Do not claim you already changed the project. If the user asks for an edit, describe what you would do or what they should change in the editor.`
    }

    const convertedMessages = await convertToModelMessages(messages)
    const result = streamText({
      model: gateway(model),
      system: systemPrompt,
      messages: convertedMessages,
      temperature: 0.7,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("[chat] Error:", error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "An error occurred during chat processing",
      }),
      { status: 500 },
    )
  }
}
