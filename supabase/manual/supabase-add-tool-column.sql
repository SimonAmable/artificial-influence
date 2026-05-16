-- Add tool column to track which tool generated each generation (flexible, no strict constraints)
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS tool TEXT NULL;

-- Add index for filtering by tool
CREATE INDEX IF NOT EXISTS idx_generations_tool ON public.generations(tool);
