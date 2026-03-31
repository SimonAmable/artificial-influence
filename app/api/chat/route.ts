import {
  streamText,
  createGateway,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
} from 'ai';
import { createClient } from '@/lib/supabase/server';
import {
  CHATBOT_SYSTEM_PROMPT,
  PROMPT_RECREATE_SYSTEM_PROMPT,
} from '@/lib/constants/system-prompts';
import {
  createEditorRenderJob,
  ensureEditorAgentSession,
  loadEditorProject,
  saveEditorAgentSession,
  updateEditorProject,
  updateEditorRenderJob,
} from '@/lib/editor/database-server';
import { interpretAgentRequest, type AgentAvailableMedia } from '@/lib/editor/agent';

export async function POST(req: Request) {
  try {
    // Check for API key
    if (!process.env.AI_GATEWAY_API_KEY) {
      console.error('[chat] AI_GATEWAY_API_KEY not set');
      return new Response(
        JSON.stringify({ error: 'AI_GATEWAY_API_KEY environment variable is not set' }),
        { status: 500 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[chat] Authentication failed:', authError?.message || 'No user');
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please log in to use chat.' }),
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const {
      messages,
      mode = 'chat',
      model = 'google/gemini-3-flash-preview',
      projectId,
      selectionItemIds = [],
      playheadFrame = 0,
    }: {
      messages: UIMessage[];
      mode?: 'chat' | 'prompt-recreate' | 'agent';
      model?: string;
      projectId?: string;
      selectionItemIds?: string[];
      playheadFrame?: number;
    } = body;

    // Create AI Gateway instance
    const gateway = createGateway({
      apiKey: process.env.AI_GATEWAY_API_KEY,
    });

    if (mode === 'agent') {
      if (!projectId) {
        return new Response(
          JSON.stringify({ error: 'projectId is required for agent mode' }),
          { status: 400 }
        );
      }

      const project = await loadEditorProject(projectId, user.id);
      if (!project) {
        return new Response(
          JSON.stringify({ error: 'Editor project not found' }),
          { status: 404 }
        );
      }

      const session = await ensureEditorAgentSession(projectId, user.id);
      const availableMedia: AgentAvailableMedia[] = [];

      const { data: assetRows } = await supabase
        .from('assets')
        .select('id, title, asset_type, asset_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      for (const asset of assetRows ?? []) {
        if (!asset.asset_url || !asset.asset_type) continue;
        availableMedia.push({
          id: String(asset.id),
          title: String(asset.title || 'Untitled Asset'),
          url: String(asset.asset_url),
          type: asset.asset_type as AgentAvailableMedia['type'],
        });
      }

      const { data: generationRows } = await supabase
        .from('generations')
        .select('id, prompt, model, type, supabase_storage_path')
        .eq('user_id', user.id)
        .neq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);

      for (const generation of generationRows ?? []) {
        const path = generation.supabase_storage_path;
        if (!path || !generation.type) continue;

        const publicUrl = supabase.storage
          .from('public-bucket')
          .getPublicUrl(path).data.publicUrl;

        if (!publicUrl) continue;

        availableMedia.push({
          id: String(generation.id),
          title: String(generation.prompt || generation.model || generation.type),
          url: publicUrl,
          type: generation.type as AgentAvailableMedia['type'],
        });
      }

      const interpretation = interpretAgentRequest({
        project,
        messages,
        session,
        selectionItemIds,
        playheadFrame,
        availableMedia,
      });

      let nextPendingAction = session.pending_action;
      let nextCommandHistory = session.command_history;
      let projectContextNote = interpretation.reply;

      if (interpretation.type === 'executed' && interpretation.nextProject) {
        await updateEditorProject(projectId, user.id, {
          composition_settings: interpretation.nextProject.composition_settings,
          timeline_state: interpretation.nextProject.timeline_state,
        });
        nextPendingAction = interpretation.pendingAction ?? null;
        if (interpretation.logEntry) {
          nextCommandHistory = [
            ...session.command_history,
            interpretation.logEntry,
          ].slice(-30);
        } else if (interpretation.command) {
          nextCommandHistory = [
            ...session.command_history,
            {
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              summary: interpretation.reply,
              command: interpretation.command,
            },
          ].slice(-30);
        }
      } else if (interpretation.type === 'pending-confirmation') {
        nextPendingAction = interpretation.pendingAction ?? null;
      } else if (interpretation.type === 'cancelled') {
        nextPendingAction = null;
      } else if (interpretation.type === 'export') {
        const renderJob = await createEditorRenderJob(projectId, user.id, {
          mode: 'agent',
          requestedAt: new Date().toISOString(),
        });

        const message =
          'I queued an export job, but the Remotion render adapter is not configured yet. The job has been marked failed until provider setup is added.';

        await updateEditorRenderJob(renderJob.id, user.id, {
          status: 'failed',
          error_message: message,
          completed_at: new Date().toISOString(),
        });

        await updateEditorProject(projectId, user.id, {
          last_render_status: 'failed',
          last_rendered_at: new Date().toISOString(),
        });

        projectContextNote = message;
        if (interpretation.logEntry) {
          nextCommandHistory = [
            ...session.command_history,
            {
              ...interpretation.logEntry,
              summary: message,
            },
          ].slice(-30);
        } else if (interpretation.command) {
          nextCommandHistory = [
            ...session.command_history,
            {
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              summary: message,
              command: interpretation.command,
            },
          ].slice(-30);
        }
      }

      const stream = createUIMessageStream({
        originalMessages: messages,
        execute: ({ writer }) => {
          const textId = crypto.randomUUID();
          writer.write({ type: 'start' });
          writer.write({ type: 'start-step' });
          writer.write({ type: 'text-start', id: textId });
          writer.write({ type: 'text-delta', id: textId, delta: projectContextNote });
          writer.write({ type: 'text-end', id: textId });
          writer.write({ type: 'finish-step' });
          writer.write({ type: 'finish' });
        },
        onFinish: async ({ messages: finalMessages }) => {
          await saveEditorAgentSession(projectId, user.id, {
            messages: finalMessages,
            pending_action: nextPendingAction,
            command_history: nextCommandHistory,
          });
        },
      });

      return createUIMessageStreamResponse({ stream });
    }

    // Select system prompt based on mode
    const systemPrompt =
      mode === 'prompt-recreate' ? PROMPT_RECREATE_SYSTEM_PROMPT : CHATBOT_SYSTEM_PROMPT;

    // Add system prompt to messages
    const systemMessage = {
      role: 'system' as const,
      content: systemPrompt,
    };

    // Convert messages and prepend system prompt
    const convertedMessages = await convertToModelMessages(messages);
    const messagesWithSystem = [systemMessage, ...convertedMessages];

    // Stream the response using selected model via AI Gateway
    const result = streamText({
      model: gateway(model),
      messages: messagesWithSystem,
      temperature: 0.7,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('[chat] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred during chat processing' 
      }),
      { status: 500 }
    );
  }
}
