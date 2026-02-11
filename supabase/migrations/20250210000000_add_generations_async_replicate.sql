-- Add columns for async Replicate (webhook) flow
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS replicate_prediction_id text,
  ADD COLUMN IF NOT EXISTS error_message text;

-- Backfill existing rows
UPDATE public.generations SET status = 'completed' WHERE status IS NULL;

COMMENT ON COLUMN public.generations.status IS 'completed | pending | failed';
COMMENT ON COLUMN public.generations.replicate_prediction_id IS 'Replicate prediction id when status is pending';
COMMENT ON COLUMN public.generations.error_message IS 'Error message when status is failed';
