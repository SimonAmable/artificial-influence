create table if not exists public.agent_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  mode text not null default 'analyze' check (mode in ('analyze', 'recreate', 'edit')),
  context_project_id uuid null references public.editor_projects(id) on delete set null,
  thread_credit_cap integer null,
  last_approved_max_estimate integer null,
  state jsonb not null default jsonb_build_object(
    'messages', '[]'::jsonb,
    'latest_plan', null,
    'plan_history', '[]'::jsonb,
    'approval_state', jsonb_build_object(
      'approved', false,
      'approved_at', null,
      'approved_max_credits', null,
      'last_rejected_at', null
    ),
    'working_memory', jsonb_build_object('pinned_refs', '[]'::jsonb),
    'tool_run_log', '[]'::jsonb,
    'result_refs', '[]'::jsonb,
    'agent_status', 'idle',
    'thread_summary', null,
    'pending_execution', null,
    'last_error', null
  ),
  last_message_at timestamptz null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.agent_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null,
  kind text not null check (kind in ('base-model', 'mini-app')),
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  approved_budget integer null,
  payload jsonb not null default '{}'::jsonb,
  result_refs jsonb not null default '[]'::jsonb,
  error_message text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_agent_threads_user_updated
  on public.agent_threads(user_id, updated_at desc);

create index if not exists idx_agent_threads_user_context_updated
  on public.agent_threads(user_id, context_project_id, updated_at desc);

create index if not exists idx_agent_runs_thread_created
  on public.agent_runs(thread_id, created_at desc);

create index if not exists idx_agent_runs_user_status
  on public.agent_runs(user_id, status, updated_at desc);

create or replace function public.handle_agent_threads_updated_at()
returns trigger
language plpgsql
as $func$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$func$;

create or replace function public.handle_agent_runs_updated_at()
returns trigger
language plpgsql
as $func$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$func$;

drop trigger if exists set_agent_threads_updated_at on public.agent_threads;
create trigger set_agent_threads_updated_at
before update on public.agent_threads
for each row
execute function public.handle_agent_threads_updated_at();

drop trigger if exists set_agent_runs_updated_at on public.agent_runs;
create trigger set_agent_runs_updated_at
before update on public.agent_runs
for each row
execute function public.handle_agent_runs_updated_at();

alter table public.agent_threads enable row level security;
alter table public.agent_runs enable row level security;

drop policy if exists "Users can view own agent threads" on public.agent_threads;
create policy "Users can view own agent threads"
on public.agent_threads
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own agent threads" on public.agent_threads;
create policy "Users can create own agent threads"
on public.agent_threads
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own agent threads" on public.agent_threads;
create policy "Users can update own agent threads"
on public.agent_threads
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own agent threads" on public.agent_threads;
create policy "Users can delete own agent threads"
on public.agent_threads
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own agent runs" on public.agent_runs;
create policy "Users can view own agent runs"
on public.agent_runs
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own agent runs" on public.agent_runs;
create policy "Users can create own agent runs"
on public.agent_runs
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own agent runs" on public.agent_runs;
create policy "Users can update own agent runs"
on public.agent_runs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own agent runs" on public.agent_runs;
create policy "Users can delete own agent runs"
on public.agent_runs
for delete
using (auth.uid() = user_id);
