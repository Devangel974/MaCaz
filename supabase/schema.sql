-- =====================================================================
--  Foyer — schéma Supabase (MVP : foyer, liste de courses, chat)
--  À coller tel quel dans Supabase > SQL Editor > New query > Run.
--  Le script est idempotent pour les fonctions/politiques (create or
--  replace / drop if exists) ; les tables sont créées si absentes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

create table if not exists public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Notre foyer' check (char_length(name) between 1 and 60),
  invite_code  text not null unique,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Un compte = un foyer (user_id en clé primaire).
create table if not exists public.household_members (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  household_id     uuid not null references public.households (id) on delete cascade,
  display_name     text not null check (char_length(display_name) between 1 and 40),
  color            text not null check (color in ('blue', 'orange')),
  expo_push_token  text,
  last_read_at     timestamptz not null default now(),
  joined_at        timestamptz not null default now()
);
create index if not exists household_members_household_idx on public.household_members (household_id);

create table if not exists public.shopping_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  quantity      text check (quantity is null or char_length(quantity) <= 30),
  category      text not null default 'autre',
  checked       boolean not null default false,
  added_by      uuid default auth.uid() references auth.users (id) on delete set null,
  checked_by    uuid references auth.users (id) on delete set null,
  checked_at    timestamptz,
  archived_at   timestamptz,           -- "Vider le panier" archive au lieu de supprimer (sert aux suggestions)
  created_at    timestamptz not null default now()
);
create index if not exists shopping_items_active_idx on public.shopping_items (household_id, archived_at);

create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  sender_id     uuid default auth.uid() references auth.users (id) on delete set null,
  kind          text not null default 'text' check (kind in ('text', 'items_added')),
  body          text not null default '' check (char_length(body) <= 4000),
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists messages_household_created_idx on public.messages (household_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2. Fonctions utilitaires
-- ---------------------------------------------------------------------

-- Foyer de l'utilisateur connecté (security definer : évite la récursion RLS).
create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.household_members where user_id = auth.uid()
$$;

-- Code d'invitation lisible (sans 0/O, 1/I/L), aléatoire cryptographique via gen_random_uuid().
create or replace function public.gen_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid());
  code text := '';
begin
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return code;
end
$$;

-- ---------------------------------------------------------------------
-- 3. RPC : créer / rejoindre un foyer
-- ---------------------------------------------------------------------

create or replace function public.create_household(p_display_name text, p_name text default 'Notre foyer')
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.households;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Tu fais déjà partie d''un foyer';
  end if;
  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Prénom requis';
  end if;

  loop
    v_code := public.gen_invite_code();
    exit when not exists (select 1 from public.households where invite_code = v_code);
  end loop;

  insert into public.households (name, invite_code, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Notre foyer'), v_code, auth.uid())
  returning * into h;

  insert into public.household_members (user_id, household_id, display_name, color)
  values (auth.uid(), h.id, trim(p_display_name), 'blue');

  return h;
end
$$;

create or replace function public.join_household(p_code text, p_display_name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.households;
  v_count int;
  v_color text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Tu fais déjà partie d''un foyer';
  end if;
  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Prénom requis';
  end if;

  select * into h
  from public.households
  where invite_code = upper(trim(p_code))
  for update;

  if h.id is null then
    raise exception 'Code invalide';
  end if;

  select count(*) into v_count from public.household_members where household_id = h.id;
  if v_count >= 2 then
    raise exception 'Ce foyer est déjà complet';
  end if;

  select case when exists (
    select 1 from public.household_members where household_id = h.id and color = 'blue'
  ) then 'orange' else 'blue' end into v_color;

  insert into public.household_members (user_id, household_id, display_name, color)
  values (auth.uid(), h.id, trim(p_display_name), v_color);

  return h;
end
$$;

revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.join_household(text, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
revoke all on function public.gen_invite_code() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Carte "X a ajouté N articles" dans le chat
--    Les ajouts successifs d'une même personne (< 15 min, sans message
--    entre-temps) sont regroupés dans une seule carte.
-- ---------------------------------------------------------------------

create or replace function public.on_shopping_item_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_msg public.messages;
begin
  select * into last_msg
  from public.messages
  where household_id = new.household_id
  order by created_at desc
  limit 1;

  if last_msg.id is not null
     and last_msg.kind = 'items_added'
     and last_msg.sender_id is not distinct from new.added_by
     and last_msg.created_at > now() - interval '15 minutes' then
    update public.messages
       set meta = jsonb_set(meta, '{items}', coalesce(meta -> 'items', '[]'::jsonb) || to_jsonb(new.name))
     where id = last_msg.id;
  else
    insert into public.messages (household_id, sender_id, kind, meta)
    values (new.household_id, new.added_by, 'items_added', jsonb_build_object('items', jsonb_build_array(new.name)));
  end if;

  return new;
end
$$;

drop trigger if exists shopping_item_added on public.shopping_items;
create trigger shopping_item_added
  after insert on public.shopping_items
  for each row execute function public.on_shopping_item_added();

-- added_by / checked_by renseignés côté serveur (on ne fait pas confiance au client)
create or replace function public.stamp_shopping_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.added_by := auth.uid();
  end if;
  if tg_op = 'UPDATE' and new.checked is distinct from old.checked then
    if new.checked then
      new.checked_by := auth.uid();
      new.checked_at := now();
    else
      new.checked_by := null;
      new.checked_at := null;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists shopping_item_stamp on public.shopping_items;
create trigger shopping_item_stamp
  before insert or update on public.shopping_items
  for each row execute function public.stamp_shopping_item();

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.shopping_items    enable row level security;
alter table public.messages          enable row level security;

-- households : lecture + renommage par les membres ; création via RPC uniquement
drop policy if exists "households_select" on public.households;
create policy "households_select" on public.households
  for select to authenticated
  using (id = (select public.my_household_id()));

drop policy if exists "households_update" on public.households;
create policy "households_update" on public.households
  for update to authenticated
  using (id = (select public.my_household_id()))
  with check (id = (select public.my_household_id()));

revoke update on public.households from authenticated;
grant update (name) on public.households to authenticated;

-- household_members : on voit les membres de son foyer, on ne modifie que sa ligne
drop policy if exists "members_select" on public.household_members;
create policy "members_select" on public.household_members
  for select to authenticated
  using (household_id = (select public.my_household_id()));

drop policy if exists "members_update_self" on public.household_members;
create policy "members_update_self" on public.household_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "members_leave" on public.household_members;
create policy "members_leave" on public.household_members
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- seules ces colonnes sont modifiables par l'utilisateur (pas de changement de foyer/couleur)
revoke update on public.household_members from authenticated;
grant update (display_name, expo_push_token, last_read_at) on public.household_members to authenticated;

-- shopping_items : accès complet pour les membres du foyer
drop policy if exists "items_select" on public.shopping_items;
create policy "items_select" on public.shopping_items
  for select to authenticated
  using (household_id = (select public.my_household_id()));

drop policy if exists "items_insert" on public.shopping_items;
create policy "items_insert" on public.shopping_items
  for insert to authenticated
  with check (household_id = (select public.my_household_id()));

drop policy if exists "items_update" on public.shopping_items;
create policy "items_update" on public.shopping_items
  for update to authenticated
  using (household_id = (select public.my_household_id()))
  with check (household_id = (select public.my_household_id()));

drop policy if exists "items_delete" on public.shopping_items;
create policy "items_delete" on public.shopping_items
  for delete to authenticated
  using (household_id = (select public.my_household_id()));

-- messages : lecture pour le foyer, envoi de messages texte en son nom uniquement
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select to authenticated
  using (household_id = (select public.my_household_id()));

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert to authenticated
  with check (
    household_id = (select public.my_household_id())
    and sender_id = (select auth.uid())
    and kind = 'text'
  );

-- ---------------------------------------------------------------------
-- 6. Temps réel
-- ---------------------------------------------------------------------

-- Changements de lignes (postgres_changes) — filtrés par RLS pour chaque abonné
do $$
begin
  begin alter publication supabase_realtime add table public.shopping_items;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.messages;          exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.household_members; exception when duplicate_object then null; end;
end
$$;

-- Canal privé "household:<id>" (présence en ligne + "en train d'écrire")
drop policy if exists "household_channel_read" on realtime.messages;
create policy "household_channel_read" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'household:' || (select public.my_household_id())::text);

drop policy if exists "household_channel_write" on realtime.messages;
create policy "household_channel_write" on realtime.messages
  for insert to authenticated
  with check (realtime.topic() = 'household:' || (select public.my_household_id())::text);
