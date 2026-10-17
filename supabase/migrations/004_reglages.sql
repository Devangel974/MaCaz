-- =====================================================================
--  MaCaz — réglages de la caz
--  Options communes aux deux membres, modifiables depuis l'écran Réglages.
--    chat_show_shopping : carte « X a ajouté N articles » dans le chat
--    chat_show_events   : carte « X a ajouté à l'agenda » dans le chat
--  Désactivée, la carte n'est plus créée (donc pas de notification push).
--  À exécuter dans Supabase > SQL Editor > Run. Idempotent.
-- =====================================================================

alter table public.households
  add column if not exists chat_show_shopping boolean not null default true,
  add column if not exists chat_show_events   boolean not null default true;

-- Les membres peuvent modifier le nom et les réglages, rien d'autre.
revoke update on public.households from authenticated;
grant update (name, chat_show_shopping, chat_show_events) on public.households to authenticated;

-- Changement de réglage visible tout de suite sur l'autre téléphone
do $$
begin
  begin alter publication supabase_realtime add table public.households; exception when duplicate_object then null; end;
end
$$;

-- ---------------------------------------------------------------------
-- Les déclencheurs respectent les réglages
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
  if not coalesce((select chat_show_shopping from public.households where id = new.household_id), true) then
    return new;
  end if;

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

create or replace function public.on_event_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select chat_show_events from public.households where id = new.household_id), true) then
    return new;
  end if;

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
