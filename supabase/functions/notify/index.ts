// Edge Function "notify" : appelée par un Database Webhook sur INSERT dans public.messages.
// Envoie une notification Expo Push à l'autre membre du foyer.
//
// Déploiement :  npx supabase functions deploy notify --no-verify-jwt
// Secret :       npx supabase secrets set WEBHOOK_SECRET=<une longue chaîne aléatoire>
// Webhook :      Database > Webhooks > table messages, événement INSERT, type "Supabase Edge Functions",
//                fonction notify, en-tête HTTP  x-webhook-secret: <même chaîne>

import { createClient } from 'npm:@supabase/supabase-js@2';

type MessageRow = {
  id: string;
  household_id: string;
  sender_id: string | null;
  kind: 'text' | 'items_added' | 'event_added';
  body: string;
  meta: { items?: string[]; title?: string; starts_at?: string; all_day?: boolean } | null;
  created_at: string;
};

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: MessageRow | null;
  old_record: MessageRow | null;
};

type ExpoTicket = { status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } };

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Fuseau du foyer (les Edge Functions tournent en UTC). Modifiable via le secret APP_TIMEZONE.
const TIMEZONE = Deno.env.get('APP_TIMEZONE') ?? 'Indian/Reunion';

function formatWhen(iso: string, allDay: boolean) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('fr-FR', { timeZone: TIMEZONE, weekday: 'short', day: 'numeric', month: 'short' }).format(d);
  if (allDay) return day;
  const time = new Intl.DateTimeFormat('fr-FR', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(d);
  return `${day} à ${time}`;
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const payload = (await req.json()) as WebhookPayload;
  const msg = payload.record;
  if (payload.table !== 'messages' || payload.type !== 'INSERT' || !msg) {
    return json({ skipped: true });
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_KEY');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey!, {
    auth: { persistSession: false },
  });

  const { data: members, error } = await supabase
    .from('household_members')
    .select('user_id, display_name, expo_push_token')
    .eq('household_id', msg.household_id);
  if (error) return json({ error: error.message }, 500);

  const sender = members?.find((m) => m.user_id === msg.sender_id);
  const targets = (members ?? []).filter((m) => m.user_id !== msg.sender_id && m.expo_push_token);
  if (targets.length === 0) return json({ sent: 0 });

  const title = sender?.display_name ?? 'MaCaz';
  let body: string;
  let url = '/chat';
  if (msg.kind === 'items_added') {
    const items = msg.meta?.items ?? [];
    body = `a ajouté ${items.join(', ') || 'un article'} à la liste`;
    url = '/courses';
  } else if (msg.kind === 'event_added') {
    body = `a ajouté à l'agenda : ${msg.meta?.title ?? 'un événement'}${
      msg.meta?.starts_at ? `, ${formatWhen(msg.meta.starts_at, msg.meta.all_day === true)}` : ''
    }`;
    url = '/agenda';
  } else {
    body = msg.body;
  }

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(
      targets.map((t) => ({
        to: t.expo_push_token,
        title,
        body: truncate(body, 180),
        sound: 'default',
        priority: 'high',
        channelId: 'messages',
        data: { url, messageId: msg.id, ...(msg.kind === 'event_added' && msg.meta?.starts_at ? { day: msg.meta.starts_at } : {}) },
      })),
    ),
  });

  const result = (await res.json()) as { data?: ExpoTicket[]; errors?: unknown };

  // Jeton périmé (appli désinstallée…) : on l'efface pour ne plus l'utiliser.
  await Promise.all(
    (result.data ?? []).map((ticket, i) =>
      ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
        ? supabase.from('household_members').update({ expo_push_token: null }).eq('user_id', targets[i].user_id)
        : null,
    ),
  );

  return json({ sent: targets.length, result });
});
