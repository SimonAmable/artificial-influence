-- Ensure generation-complete Telegram alerts fire at most once per row.

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS telegram_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_generations_telegram_notified_at
  ON public.generations (telegram_notified_at)
  WHERE telegram_notified_at IS NOT NULL;

COMMENT ON COLUMN public.generations.telegram_notified_at IS
  'When a generation-complete Telegram alert was sent (null = not sent yet).';
