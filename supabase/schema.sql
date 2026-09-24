-- Charlie Training V3 - Supabase schema
-- Run in Supabase SQL Editor once the project is created.

create extension if not exists pgcrypto;

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id text not null,
  started_at timestamptz,
  finished_at timestamptz not null,
  logs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sleep_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('bed','wake')),
  event_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.workout_sessions enable row level security;
alter table public.sleep_events enable row level security;

drop policy if exists "own workout sessions" on public.workout_sessions;
create policy "own workout sessions"
on public.workout_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "own sleep events" on public.sleep_events;
create policy "own sleep events"
on public.sleep_events
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists workout_sessions_user_finished_idx
on public.workout_sessions(user_id, finished_at desc);

create index if not exists sleep_events_user_event_idx
on public.sleep_events(user_id, event_at desc);
