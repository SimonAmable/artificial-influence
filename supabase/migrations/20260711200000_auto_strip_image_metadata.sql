alter table public.profiles
  add column if not exists auto_strip_image_metadata boolean not null default false;
