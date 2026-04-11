ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS chat_thread_id uuid REFERENCES public.chat_threads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chat_message_id text,
  ADD COLUMN IF NOT EXISTS chat_tool_call_id text;

CREATE INDEX IF NOT EXISTS idx_generations_chat_thread_id
  ON public.generations (chat_thread_id);

CREATE INDEX IF NOT EXISTS idx_generations_prediction_chat
  ON public.generations (replicate_prediction_id, chat_thread_id, chat_tool_call_id);

COMMENT ON COLUMN public.generations.chat_thread_id IS 'Chat thread that owns the pending/completed media tool call.';
COMMENT ON COLUMN public.generations.chat_message_id IS 'Assistant UIMessage id containing the media tool part.';
COMMENT ON COLUMN public.generations.chat_tool_call_id IS 'AI SDK toolCallId for the persisted media tool part.';
