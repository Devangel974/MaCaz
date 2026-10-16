-- =====================================================================
--  MaCaz — suppression dans le chat
--  Les deux membres de la caz peuvent supprimer n'importe quel élément du
--  chat (message, carte « articles ajoutés », carte « ajouté à l'agenda »),
--  ou vider toute la conversation. Les articles et événements eux-mêmes
--  ne sont pas touchés.
--  À exécuter dans Supabase > SQL Editor > Run. Idempotent.
-- =====================================================================

drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages
  for delete to authenticated
  using (household_id = (select public.my_household_id()));
