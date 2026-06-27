-- Run this in Supabase SQL Editor
create table import_tokens (
  token      text primary key default encode(gen_random_bytes(24), 'hex'),
  user_id    uuid not null references auth.users(id) on delete cascade,
  used       boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours'
);

alter table import_tokens enable row level security;
create policy "Users manage own tokens" on import_tokens
  for all using (auth.uid() = user_id);
