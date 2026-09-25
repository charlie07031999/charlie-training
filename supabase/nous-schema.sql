create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nous',
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (household_id,user_id),
  unique (user_id)
);

create table if not exists public.household_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check (kind in ('shopping','task','idea','trip','note')),
  title text not null,
  details text,
  due_at timestamptz,
  assignee text not null default 'both' check (assignee in ('owner','member','both')),
  done boolean not null default false,
  pinned boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  details text,
  assignee text not null default 'both' check (assignee in ('owner','member','both')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists household_items_household_idx
on public.household_items(household_id,done,created_at desc);

create index if not exists household_events_household_idx
on public.household_events(household_id,starts_at);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_items enable row level security;
alter table public.household_events enable row level security;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_household_member(household uuid)
returns boolean
language sql
stable
security definer
set search_path=public,private
as $$
  select exists(
    select 1 from public.household_members hm
    where hm.household_id=household
      and hm.user_id=auth.uid()
  );
$$;

revoke all on function private.is_household_member(uuid) from public,anon;
grant execute on function private.is_household_member(uuid) to authenticated;

drop policy if exists "members read households" on public.households;
create policy "members read households"
on public.households for select to authenticated
using (private.is_household_member(id));

drop policy if exists "members read members" on public.household_members;
create policy "members read members"
on public.household_members for select to authenticated
using (private.is_household_member(household_id));

drop policy if exists "members manage items" on public.household_items;
create policy "members manage items"
on public.household_items for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

drop policy if exists "members manage events" on public.household_events;
create policy "members manage events"
on public.household_events for all to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create or replace function public.create_household(household_name text,display_name text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  if not exists (
    select 1 from auth.users
    where id=auth.uid()
      and email is not null
      and coalesce(is_anonymous,false)=false
  ) then
    raise exception 'email account required';
  end if;

  if exists(select 1 from public.household_members where user_id=auth.uid()) then
    raise exception 'already in a household';
  end if;

  insert into public.households(name,created_by)
  values (coalesce(nullif(trim(household_name),''),'Nous'),auth.uid())
  returning id into new_id;

  insert into public.household_members(household_id,user_id,display_name,role)
  values(new_id,auth.uid(),coalesce(nullif(trim(display_name),''),'Moi'),'owner');

  return new_id;
end;
$$;

create or replace function public.join_household_by_code(invite_code_input text,display_name text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare target_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  if not exists (
    select 1 from auth.users
    where id=auth.uid()
      and email is not null
      and coalesce(is_anonymous,false)=false
  ) then
    raise exception 'email account required';
  end if;

  if exists(select 1 from public.household_members where user_id=auth.uid()) then
    raise exception 'already in a household';
  end if;

  select id into target_id
  from public.households
  where invite_code=upper(trim(invite_code_input));

  if target_id is null then raise exception 'invalid invite code'; end if;
  if (select count(*) from public.household_members where household_id=target_id)>=2 then
    raise exception 'household already has two members';
  end if;

  insert into public.household_members(household_id,user_id,display_name,role)
  values(target_id,auth.uid(),coalesce(nullif(trim(display_name),''),'Partenaire'),'member');

  return target_id;
end;
$$;

revoke all on function public.create_household(text,text) from public,anon;
revoke all on function public.join_household_by_code(text,text) from public,anon;
grant execute on function public.create_household(text,text) to authenticated;
grant execute on function public.join_household_by_code(text,text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='household_items'
  ) then
    alter publication supabase_realtime add table public.household_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='household_events'
  ) then
    alter publication supabase_realtime add table public.household_events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='household_members'
  ) then
    alter publication supabase_realtime add table public.household_members;
  end if;
end $$;
