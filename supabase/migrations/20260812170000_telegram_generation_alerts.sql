-- Telegram generation alerts: one column on profiles.
-- Connected chat_id = alerts on. NULL = alerts off.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id
  ON public.profiles (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- Linking is service_role only (via signed /start token + webhook).
CREATE OR REPLACE FUNCTION public.protect_profiles_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' OR session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.credits IS DISTINCT FROM OLD.credits
     OR NEW.is_pro IS DISTINCT FROM OLD.is_pro
     OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.telegram_chat_id IS DISTINCT FROM OLD.telegram_chat_id THEN
    RAISE EXCEPTION 'Cannot update protected profile fields';
  END IF;

  RETURN NEW;
END;
$$;
