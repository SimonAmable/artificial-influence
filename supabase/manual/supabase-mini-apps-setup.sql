-- Mini apps table for publishing customer-facing workflow snapshots
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS mini_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    workflow_version TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    thumbnail_url TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    featured_output_node_id TEXT,
    node_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    snapshot_nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    snapshot_edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mini_apps_user_id_idx ON mini_apps(user_id);
CREATE INDEX IF NOT EXISTS mini_apps_workflow_id_idx ON mini_apps(workflow_id);
CREATE INDEX IF NOT EXISTS mini_apps_status_idx ON mini_apps(status);
CREATE INDEX IF NOT EXISTS mini_apps_slug_idx ON mini_apps(slug);

ALTER TABLE mini_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mini apps"
    ON mini_apps
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view published mini apps"
    ON mini_apps
    FOR SELECT
    USING (status = 'published');

CREATE POLICY "Users can insert own mini apps"
    ON mini_apps
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mini apps"
    ON mini_apps
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mini apps"
    ON mini_apps
    FOR DELETE
    USING (auth.uid() = user_id);

CREATE TRIGGER update_mini_apps_updated_at
    BEFORE UPDATE ON mini_apps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
