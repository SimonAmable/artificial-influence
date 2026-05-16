CREATE TABLE IF NOT EXISTS public.chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_user_id_updated_at
  ON public.chat_threads (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  role TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  message JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (thread_id, message_id),
  UNIQUE (thread_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id_sort_order
  ON public.chat_messages (thread_id, sort_order ASC);

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chat threads" ON public.chat_threads;
CREATE POLICY "Users can view own chat threads"
  ON public.chat_threads
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own chat threads" ON public.chat_threads;
CREATE POLICY "Users can create own chat threads"
  ON public.chat_threads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chat threads" ON public.chat_threads;
CREATE POLICY "Users can update own chat threads"
  ON public.chat_threads
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat threads" ON public.chat_threads;
CREATE POLICY "Users can delete own chat threads"
  ON public.chat_threads
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;
CREATE POLICY "Users can view own chat messages"
  ON public.chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
        AND chat_threads.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own chat messages" ON public.chat_messages;
CREATE POLICY "Users can create own chat messages"
  ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
        AND chat_threads.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own chat messages" ON public.chat_messages;
CREATE POLICY "Users can update own chat messages"
  ON public.chat_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
        AND chat_threads.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
        AND chat_threads.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own chat messages" ON public.chat_messages;
CREATE POLICY "Users can delete own chat messages"
  ON public.chat_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
        AND chat_threads.user_id = auth.uid()
    )
  );
