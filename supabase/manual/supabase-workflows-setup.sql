-- Workflows table for saving and sharing group/subflow templates
-- Run this SQL in your Supabase SQL Editor

-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS workflows_user_id_idx ON workflows(user_id);
CREATE INDEX IF NOT EXISTS workflows_updated_at_idx ON workflows(updated_at DESC);
CREATE INDEX IF NOT EXISTS workflows_is_public_idx ON workflows(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS workflows_user_public_idx ON workflows(user_id, is_public);

-- Enable Row Level Security
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own workflows
CREATE POLICY "Users can view own workflows"
    ON workflows
    FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policy: Users can view public workflows from any user
CREATE POLICY "Users can view public workflows"
    ON workflows
    FOR SELECT
    USING (is_public = true);

-- RLS Policy: Users can insert their own workflows
CREATE POLICY "Users can insert own workflows"
    ON workflows
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own workflows
CREATE POLICY "Users can update own workflows"
    ON workflows
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own workflows
CREATE POLICY "Users can delete own workflows"
    ON workflows
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Storage RLS policies for workflow thumbnails in public-bucket
-- Uses existing 'public-bucket' with folder structure: {user_id}/workflow-thumbnails/...
CREATE POLICY "Users can upload workflow thumbnails to public bucket"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'public-bucket' 
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND name LIKE auth.uid()::text || '/workflow-thumbnails/%'
    );

CREATE POLICY "Users can update their workflow thumbnails in public bucket"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'public-bucket' 
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND name LIKE auth.uid()::text || '/workflow-thumbnails/%'
    );

CREATE POLICY "Users can delete their workflow thumbnails in public bucket"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'public-bucket' 
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND name LIKE auth.uid()::text || '/workflow-thumbnails/%'
    );

CREATE POLICY "Anyone can view workflow thumbnails in public bucket"
    ON storage.objects
    FOR SELECT
    TO public
    USING (
        bucket_id = 'public-bucket' 
        AND name LIKE '%/workflow-thumbnails/%'
    );

-- Verify setup
SELECT 
    'Workflows table created' as status,
    COUNT(*) as workflow_count 
FROM workflows;
