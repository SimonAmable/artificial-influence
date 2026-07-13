alter table public.profiles
  add column if not exists default_enhance_prompt boolean not null default false;
