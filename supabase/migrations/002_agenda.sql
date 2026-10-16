-- =====================================================================
--  MaCaz — étape 2 : agenda partagé
--  À exécuter APRÈS schema.sql, dans Supabase > SQL Editor > Run.
--  Idempotent : peut être relancé sans casse.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table des événements
-- ---------------------------------------------------------------------

create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 120),
  starts_at         timestamptz not null,
  ends_at           timestamptz check (ends_at is null or ends_at >= starts_at),
  all_day           boolean not null default false,
  for_user          uuid references auth.users (id) on delete set null,   -- null = ensemble
  location          text check (location is null or char_length(location) <= 120),
  reminder_minutes  int check (reminder_minutes is null or reminder_minutes between 0 and 10080),
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists events_household_starts_idx on public.events (household_id, starts_at);

-- created_by / updated_at posés côté serveur
create or replace function public.stamp_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.created_by := old.created_by;
    new.household_id := old.household_id;
  end if;
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists event_stamp on public.events;
create trigger event_stamp
  before insert or update on public.events
  for each row execute function public.stamp_event();

-- ---------------------------------------------------------------------
-- 2. Carte « X a ajouté un événement » dans le chat
--    (le webhook existant sur messages envoie alors la notification push)
-- ---------------------------------------------------------------------

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check check (kind in ('text', 'items_added', 'event_added'));

create or replace function public.on_event_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.messages (household_id, sender_id, kind, meta)
  values (
    new.household_id,
    new.created_by,
    'event_added',
    jsonb_build_object(
      'event_id', new.id,
      'title', new.title,
      'starts_at', new.starts_at,
      'all_day', new.all_day,
      'for_user', new.for_user
    )
  );
  return new;
end
$$;

drop trigger if exists event_added on public.events;
create trigger event_added
  after insert on public.events
  for each row execute function public.on_event_added();

-- ---------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------

alter table public.events enable row level security;

-- for_user doit être un membre du foyer (ou null = ensemble)
create or replace function public.is_household_member(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where user_id = p_user and household_id = public.my_household_id()
  )
$$;

drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events
  for select to authenticated
  using (household_id = (select public.my_household_id()));

drop policy if exists "events_insert" on public.events;
create policy "events_insert" on public.events
  for insert to authenticated
  with check (
    household_id = (select public.my_household_id())
    and (for_user is null or public.is_household_member(for_user))
  );

drop policy if exists "events_update" on public.events;
create policy "events_update" on public.events
  for update to authenticated
  using (household_id = (select public.my_household_id()))
  with check (
    household_id = (select public.my_household_id())
    and (for_user is null or public.is_household_member(for_user))
  );

drop policy if exists "events_delete" on public.events;
create policy "events_delete" on public.events
  for delete to authenticated
  using (household_id = (select public.my_household_id()));

-- ---------------------------------------------------------------------
-- 4. Temps réel
-- ---------------------------------------------------------------------

do $$
begin
  begin alter publication supabase_realtime add table public.events; exception when duplicate_object then null; end;
end
$$;
