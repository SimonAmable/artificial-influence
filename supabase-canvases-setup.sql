-- =====================================================
-- Canvas Save/Restore System Setup
-- =====================================================
-- This script creates the canvases table for storing React Flow canvas data
-- with support for multiple canvases per user, thumbnails, and future collaboration

-- Drop existing table if needed (BE CAREFUL IN PRODUCTION)
-- DROP TABLE IF EXISTS public.canvases CASCADE;

-- =====================================================
-- Create canvases table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.canvases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Canvas',
    description TEXT,
    thumbnail_url TEXT, -- URL to canvas thumbnail in Supabase Storage
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb, -- React Flow nodes array
    edges JSONB NOT NULL DEFAULT '[]'::jsonb, -- React Flow edges array
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    last_opened_at TIMESTAMPTZ,
    last_edited_by UUID REFERENCES auth.users(id), -- For future collaboration features
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_canvases_user_id ON public.canvases(user_id);
CREATE INDEX IF NOT EXISTS idx_canvases_updated_at ON public.canvases(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_canvases_user_updated ON public.canvases(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_canvases_user_favorite ON public.canvases(user_id, is_favorite) WHERE is_favorite = true;

-- =====================================================
-- Create updated_at trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_canvases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_canvases_updated_at ON public.canvases;
CREATE TRIGGER set_canvases_updated_at
    BEFORE UPDATE ON public.canvases
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_canvases_updated_at();

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================
ALTER TABLE public.canvases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own canvases" ON public.canvases;
DROP POLICY IF EXISTS "Users can create their own canvases" ON public.canvases;
DROP POLICY IF EXISTS "Users can update their own canvases" ON public.canvases;
DROP POLICY IF EXISTS "Users can delete their own canvases" ON public.canvases;

-- Users can only view their own canvases
CREATE POLICY "Users can view their own canvases"
    ON public.canvases
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own canvases
CREATE POLICY "Users can create their own canvases"
    ON public.canvases
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own canvases
CREATE POLICY "Users can update their own canvases"
    ON public.canvases
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own canvases
CREATE POLICY "Users can delete their own canvases"
    ON public.canvases
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- Verification Query
-- =====================================================
-- Run this to verify the setup:
-- SELECT 
--     table_name,
--     (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'canvases') as column_count,
--     (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'canvases') as index_count,
--     (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'canvases') as policy_count
-- FROM information_schema.tables 
-- WHERE table_name = 'canvases';
