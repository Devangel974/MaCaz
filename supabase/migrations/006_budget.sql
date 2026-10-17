-- =====================================================================
--  MaCaz — étape 4 : budget du foyer
--  - budget_operations : dépenses et revenus (montants en centimes)
--  - budget_recurring  : opérations qui reviennent chaque mois (loyer, Netflix…)
--    apply_recurring() les ajoute le jour prévu (idempotent, appelée par l'appli)
--  - Carte « X a ajouté une dépense » dans le chat (réglage chat_show_budget)
--  À exécuter dans Supabase > SQL Editor > Run. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Réglage commun + nouveau type de carte
-- ---------------------------------------------------------------------

alter table public.households
  add column if not exists chat_show_budget boolean not null default true;

revoke update on public.households from authenticated;
grant update (name, chat_show_shopping, chat_show_events, chat_show_documents, chat_show_budget)
  on public.households to authenticated;

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check
  check (kind in ('text', 'items_added', 'event_added', 'document_added', 'document_expiring', 'expense_added'));

-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------

create table if not exists public.budget_recurring (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  kind           text not null default 'expense' check (kind in ('expense', 'income')),
  amount_cents   int  not null check (amount_cents > 0 and amount_cents < 100000000),
  label          text not null check (char_length(label) between 1 and 80),
  category       text not null,
  paid_by        uuid references auth.users (id) on delete set null,   -- null = compte commun
  day_of_month   int  not null check (day_of_month between 1 and 31),
  next_month     date not null,   -- 1er du prochain mois à générer
  active         boolean not null default true,
  notes          text check (notes is null or char_length(notes) <= 500),
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists budget_recurring_household_idx on public.budget_recurring (household_id);

create table if not exists public.budget_operations (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  kind           text not null default 'expense' check (kind in ('expense', 'income')),
  amount_cents   int  not null check (amount_cents > 0 and amount_cents < 100000000),
  label          text not null check (char_length(label) between 1 and 80),
  category       text not null,
  paid_by        uuid references auth.users (id) on delete set null,   -- null = compte commun
  op_date        date not null default current_date,
  notes          text check (notes is null or char_length(notes) <= 500),
  recurring_id   uuid references public.budget_recurring (id) on delete set null,
  recurring_month date,
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (recurring_id, recurring_month)
);
create index if not exists budget_operations_household_idx on public.budget_operations (household_id, op_date desc);

-- Catégories autorisées (les mêmes que dans l'appli, src/lib/budget.ts)
alter table public.budget_operations drop constraint if exists budget_operations_category_check;
alter table public.budget_operations add constraint budget_operations_category_check check (category in (
  'courses', 'logement', 'factures', 'transport', 'sorties', 'sante', 'abonnements', 'shopping', 'autre',
  'salaire', 'aides', 'remboursement', 'autre_revenu'));
alter table public.budget_recurring drop constraint if exists budget_recurring_category_check;
alter table public.budget_recurring add constraint budget_recurring_category_check check (category in (
  'courses', 'logement', 'factures', 'transport', 'sorties', 'sante', 'abonnements', 'shopping', 'autre',
  'salaire', 'aides', 'remboursement', 'autre_revenu'));

-- created_by / household_id posés côté serveur
create or replace function public.stamp_budget_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- apply_recurring() (security definer) garde l'auteur de la récurrence
    if current_user in ('authenticated', 'anon') then
      new.created_by := auth.uid();
    end if;
  else
    new.created_by := old.created_by;
    new.household_id := old.household_id;
  end if;
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists budget_operation_stamp on public.budget_operations;
create trigger budget_operation_stamp
  before insert or update on public.budget_operations
  for each row execute function public.stamp_budget_row();

drop trigger if exists budget_recurring_stamp on public.budget_recurring;
create trigger budget_recurring_stamp
  before insert or update on public.budget_recurring
  for each row execute function public.stamp_budget_row();

-- ---------------------------------------------------------------------
-- 3. Carte « X a ajouté une dépense » (pas pour les opérations automatiques)
-- ---------------------------------------------------------------------

create or replace function public.on_budget_operation_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.recurring_id is null
     and coalesce((select chat_show_budget from public.households where id = new.household_id), true) then
    insert into public.messages (household_id, sender_id, kind, meta)
    values (new.household_id, new.created_by, 'expense_added',
            jsonb_build_object('operation_id', new.id, 'kind', new.kind, 'label', new.label,
                               'amount_cents', new.amount_cents, 'category', new.category));
  end if;
  return new;
end
$$;

drop trigger if exists budget_operation_added on public.budget_operations;
create trigger budget_operation_added
  after insert on public.budget_operations
  for each row execute function public.on_budget_operation_added();

-- ---------------------------------------------------------------------
-- 4. Opérations récurrentes : ajoutées le jour prévu
--    Une opération supprimée à la main ne revient pas (next_month avance).
--    Jour 31 en février → dernier jour du mois.
-- ---------------------------------------------------------------------

create or replace function public.apply_recurring()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid := public.my_household_id();
  today date := (now() at time zone 'Indian/Reunion')::date;
  r record;
  due date;
  n int := 0;
begin
  if hid is null then return 0; end if;

  for r in
    select * from public.budget_recurring
    where household_id = hid and active
    for update
  loop
    loop
      due := least(r.next_month + (r.day_of_month - 1),
                   (r.next_month + interval '1 month' - interval '1 day')::date);
      exit when due > today;
      insert into public.budget_operations
        (household_id, kind, amount_cents, label, category, paid_by, op_date, notes,
         recurring_id, recurring_month, created_by)
      values
        (hid, r.kind, r.amount_cents, r.label, r.category, r.paid_by, due, r.notes,
         r.id, r.next_month, r.created_by)
      on conflict (recurring_id, recurring_month) do nothing;
      n := n + 1;
      r.next_month := (r.next_month + interval '1 month')::date;
    end loop;
    update public.budget_recurring set next_month = r.next_month where id = r.id;
  end loop;
  return n;
end
$$;

revoke all on function public.apply_recurring() from public, anon;
grant execute on function public.apply_recurring() to authenticated;

-- ---------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------

alter table public.budget_operations enable row level security;
alter table public.budget_recurring enable row level security;

do $$
declare t text;
begin
  foreach t in array array['budget_operations', 'budget_recurring'] loop
    execute format('drop policy if exists "%1$s_select" on public.%1$I', t);
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated
                    using (household_id = (select public.my_household_id()))', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$I', t);
    execute format('create policy "%1$s_insert" on public.%1$I for insert to authenticated
                    with check (household_id = (select public.my_household_id())
                                and (paid_by is null or public.is_household_member(paid_by)))', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$I', t);
    execute format('create policy "%1$s_update" on public.%1$I for update to authenticated
                    using (household_id = (select public.my_household_id()))
                    with check (household_id = (select public.my_household_id())
                                and (paid_by is null or public.is_household_member(paid_by)))', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$I', t);
    execute format('create policy "%1$s_delete" on public.%1$I for delete to authenticated
                    using (household_id = (select public.my_household_id()))', t);
  end loop;
end
$$;

do $$
begin
  begin alter publication supabase_realtime add table public.budget_operations; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.budget_recurring; exception when duplicate_object then null; end;
end
$$;
