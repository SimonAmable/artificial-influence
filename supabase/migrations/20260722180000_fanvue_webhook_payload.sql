-- Store full Fanvue webhook envelope for debugging and replay

ALTER TABLE public.fanvue_webhook_events
  ADD COLUMN IF NOT EXISTS payload JSONB;
