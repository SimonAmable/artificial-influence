begin;

drop policy if exists "Users can view own agent runs" on public.agent_runs;
drop policy if exists "Users can create own agent runs" on public.agent_runs;
drop policy if exists "Users can update own agent runs" on public.agent_runs;
drop policy if exists "Users can delete own agent runs" on public.agent_runs;

drop policy if exists "Users can view own agent threads" on public.agent_threads;
drop policy if exists "Users can create own agent threads" on public.agent_threads;
drop policy if exists "Users can update own agent threads" on public.agent_threads;
drop policy if exists "Users can delete own agent threads" on public.agent_threads;

drop policy if exists "Users can view own editor agent sessions" on public.editor_agent_sessions;
drop policy if exists "Users can create own editor agent sessions" on public.editor_agent_sessions;
drop policy if exists "Users can update own editor agent sessions" on public.editor_agent_sessions;
drop policy if exists "Users can delete own editor agent sessions" on public.editor_agent_sessions;

drop trigger if exists set_agent_runs_updated_at on public.agent_runs;
drop trigger if exists set_agent_threads_updated_at on public.agent_threads;
drop trigger if exists set_editor_agent_sessions_updated_at on public.editor_agent_sessions;

drop table if exists public.agent_runs cascade;
drop table if exists public.agent_threads cascade;
drop table if exists public.editor_agent_sessions cascade;

drop function if exists public.handle_agent_runs_updated_at();
drop function if exists public.handle_agent_threads_updated_at();

commit;
