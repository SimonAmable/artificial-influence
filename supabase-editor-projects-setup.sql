create table if not exists public.editor_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled Project',
  description text,
  thumbnail_url text,
  composition_settings jsonb not null,
  timeline_state jsonb not null,
  last_render_status text not null default 'idle',
  last_rendered_at timestamptz,
  last_opened_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.editor_renders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.editor_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued',
  provider text not null default 'adapter',
  provider_job_id text,
  output_url text,
  output_asset_id uuid references public.assets(id) on delete set null,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz
);

create table if not exists public.editor_agent_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.editor_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  pending_action jsonb,
  command_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique(project_id, user_id)
);

create index if not exists idx_editor_projects_user_updated
  on public.editor_projects(user_id, updated_at desc);

create index if not exists idx_editor_projects_updated
  on public.editor_projects(updated_at desc);

create index if not exists idx_editor_renders_project_created
  on public.editor_renders(project_id, created_at desc);

create index if not exists idx_editor_renders_user_created
  on public.editor_renders(user_id, created_at desc);

create index if not exists idx_editor_agent_sessions_user_project
  on public.editor_agent_sessions(user_id, project_id);

create or replace function public.handle_editor_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_editor_projects_updated_at on public.editor_projects;
create trigger set_editor_projects_updated_at
before update on public.editor_projects
for each row
execute function public.handle_editor_updated_at();

drop trigger if exists set_editor_renders_updated_at on public.editor_renders;
create trigger set_editor_renders_updated_at
before update on public.editor_renders
for each row
execute function public.handle_editor_updated_at();

drop trigger if exists set_editor_agent_sessions_updated_at on public.editor_agent_sessions;
create trigger set_editor_agent_sessions_updated_at
before update on public.editor_agent_sessions
for each row
execute function public.handle_editor_updated_at();

alter table public.editor_projects enable row level security;
alter table public.editor_renders enable row level security;
alter table public.editor_agent_sessions enable row level security;

drop policy if exists "Users can view own editor projects" on public.editor_projects;
create policy "Users can view own editor projects"
on public.editor_projects
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own editor projects" on public.editor_projects;
create policy "Users can create own editor projects"
on public.editor_projects
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own editor projects" on public.editor_projects;
create policy "Users can update own editor projects"
on public.editor_projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own editor projects" on public.editor_projects;
create policy "Users can delete own editor projects"
on public.editor_projects
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own editor renders" on public.editor_renders;
create policy "Users can view own editor renders"
on public.editor_renders
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own editor renders" on public.editor_renders;
create policy "Users can create own editor renders"
on public.editor_renders
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own editor renders" on public.editor_renders;
create policy "Users can update own editor renders"
on public.editor_renders
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own editor renders" on public.editor_renders;
create policy "Users can delete own editor renders"
on public.editor_renders
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own editor agent sessions" on public.editor_agent_sessions;
create policy "Users can view own editor agent sessions"
on public.editor_agent_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own editor agent sessions" on public.editor_agent_sessions;
create policy "Users can create own editor agent sessions"
on public.editor_agent_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own editor agent sessions" on public.editor_agent_sessions;
create policy "Users can update own editor agent sessions"
on public.editor_agent_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own editor agent sessions" on public.editor_agent_sessions;
create policy "Users can delete own editor agent sessions"
on public.editor_agent_sessions
for delete
using (auth.uid() = user_id);
