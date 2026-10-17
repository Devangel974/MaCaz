-- =====================================================================
--  MaCaz — étape 3 : papiers (documents importants)
--  - Table documents (fiche) + fichiers PDF dans un bucket Storage PRIVÉ
--  - Accès limité aux deux membres de la caz (RLS, chemins "<caz>/…")
--  - Cartes dans le chat : « X a ajouté un papier » et « … expire bientôt »
--    (désactivables dans Réglages › Chat, activées par défaut)
--  À exécuter dans Supabase > SQL Editor > Run. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Réglage commun + nouveaux types de cartes dans le chat
-- ---------------------------------------------------------------------

alter table public.households
  add column if not exists chat_show_documents boolean not null default true;

revoke update on public.households from authenticated;
grant update (name, chat_show_shopping, chat_show_events, chat_show_documents) on public.households to authenticated;

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check
  check (kind in ('text', 'items_added', 'event_added', 'document_added', 'document_expiring'));

-- ---------------------------------------------------------------------
-- 2. Table des papiers
-- ---------------------------------------------------------------------

create table if not exists public.documents (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 80),
  doc_type         text not null default 'autre'
                   check (doc_type in ('passeport', 'identite', 'permis', 'vitale', 'assurance', 'carte_grise', 'autre')),
  owner_user       uuid references auth.users (id) on delete set null,   -- null = la caz
  expires_at       date,
  remind_days      int[] not null default '{180,30,0}',                  -- jours avant l'expiration
  agenda_event_id  uuid references public.events (id) on delete set null,
  notes            text check (notes is null or char_length(notes) <= 1000),
  file_path        text,          -- "<household_id>/<document_id>/<nom>.pdf"
  thumb_path       text,          -- miniature JPEG de la 1re page (photos uniquement)
  page_count       int,
  size_bytes       int,
  last_alert_days  int,           -- dernier seuil de rappel signalé dans le chat
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists documents_household_idx on public.documents (household_id, expires_at);

create or replace function public.stamp_document()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.last_alert_days := null;
  else
    new.created_by := old.created_by;
    new.household_id := old.household_id;
    -- Nouvelle date d'expiration (papier renouvelé) : les rappels repartent de zéro.
    if new.expires_at is distinct from old.expires_at then
      new.last_alert_days := null;
    elsif current_user in ('authenticated', 'anon') then
      -- seul check_document_alerts() (security definer) peut le modifier
      new.last_alert_days := old.last_alert_days;
    end if;
  end if;
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists document_stamp on public.documents;
create trigger document_stamp
  before insert or update on public.documents
  for each row execute function public.stamp_document();

-- Carte « X a ajouté un papier »
create or replace function public.on_document_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select chat_show_documents from public.households where id = new.household_id), true) then
    insert into public.messages (household_id, sender_id, kind, meta)
    values (new.household_id, new.created_by, 'document_added',
            jsonb_build_object('document_id', new.id, 'title', new.title, 'doc_type', new.doc_type,
                               'owner_user', new.owner_user, 'expires_at', new.expires_at));
  end if;
  return new;
end
$$;

drop trigger if exists document_added on public.documents;
create trigger document_added
  after insert on public.documents
  for each row execute function public.on_document_added();

-- ---------------------------------------------------------------------
-- 3. Alertes d'expiration dans le chat
--    Appelée par l'appli à l'ouverture (idempotent) : pour chaque papier qui
--    vient de franchir un seuil (180 j, 30 j, jour J…), une seule carte.
--    sender_id = null → la notification part vers les deux téléphones.
-- ---------------------------------------------------------------------

create or replace function public.check_document_alerts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid := public.my_household_id();
  today date := (now() at time zone 'Indian/Reunion')::date;
  show boolean;
  d record;
  days_left int;
  threshold int;
  n int := 0;
begin
  if hid is null then return 0; end if;
  select chat_show_documents into show from public.households where id = hid;

  for d in
    select * from public.documents
    where household_id = hid and expires_at is not null
    for update
  loop
    days_left := d.expires_at - today;
    -- plus petit seuil déjà franchi (ex. 30 si on est à 25 jours)
    select min(t) into threshold from unnest(d.remind_days) as t where days_left <= t;
    if threshold is null then continue; end if;
    if d.last_alert_days is not null and d.last_alert_days <= threshold then continue; end if;

    update public.documents set last_alert_days = threshold where id = d.id;
    if coalesce(show, true) then
      insert into public.messages (household_id, sender_id, kind, meta)
      values (hid, null, 'document_expiring',
              jsonb_build_object('document_id', d.id, 'title', d.title, 'doc_type', d.doc_type,
                                 'owner_user', d.owner_user, 'expires_at', d.expires_at,
                                 'days_left', days_left));
      n := n + 1;
    end if;
  end loop;
  return n;
end
$$;

revoke all on function public.check_document_alerts() from public, anon;
grant execute on function public.check_document_alerts() to authenticated;

-- ---------------------------------------------------------------------
-- 4. RLS sur la table
-- ---------------------------------------------------------------------

alter table public.documents enable row level security;

drop policy if exists "documents_select" on public.documents;
create policy "documents_select" on public.documents
  for select to authenticated
  using (household_id = (select public.my_household_id()));

drop policy if exists "documents_insert" on public.documents;
create policy "documents_insert" on public.documents
  for insert to authenticated
  with check (
    household_id = (select public.my_household_id())
    and (owner_user is null or public.is_household_member(owner_user))
  );

drop policy if exists "documents_update" on public.documents;
create policy "documents_update" on public.documents
  for update to authenticated
  using (household_id = (select public.my_household_id()))
  with check (
    household_id = (select public.my_household_id())
    and (owner_user is null or public.is_household_member(owner_user))
  );

drop policy if exists "documents_delete" on public.documents;
create policy "documents_delete" on public.documents
  for delete to authenticated
  using (household_id = (select public.my_household_id()));

do $$
begin
  begin alter publication supabase_realtime add table public.documents; exception when duplicate_object then null; end;
end
$$;

-- ---------------------------------------------------------------------
-- 5. Stockage : bucket privé « documents » (50 Mo max par fichier)
--    Chaque fichier est rangé sous "<household_id>/…" : on n'accède qu'à sa caz.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 52428800, array['application/pdf', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documents_files_select" on storage.objects;
create policy "documents_files_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.my_household_id())::text);

drop policy if exists "documents_files_insert" on storage.objects;
create policy "documents_files_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.my_household_id())::text);

drop policy if exists "documents_files_update" on storage.objects;
create policy "documents_files_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.my_household_id())::text);

drop policy if exists "documents_files_delete" on storage.objects;
create policy "documents_files_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.my_household_id())::text);
