import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Message } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import { useHousehold } from './HouseholdProvider';

const PAGE = 50;

export type ChatMessage = Message & { pending?: boolean };

type ChatContextValue = {
  loading: boolean;
  /** Du plus récent au plus ancien (pour une FlatList inversée). */
  messages: ChatMessage[];
  hasMore: boolean;
  loadMore: () => Promise<void>;
  send: (body: string) => Promise<void>;
  /** Supprime un élément du chat (pour les deux). */
  remove: (id: string) => Promise<void>;
  /** Vide toute la conversation (pour les deux). */
  clearAll: () => Promise<void>;
  unreadCount: number;
  lastMessage: ChatMessage | null;
  markRead: () => void;
  partnerOnline: boolean;
  partnerTyping: boolean;
  notifyTyping: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

const newestFirst = (a: Message, b: Message) => b.created_at.localeCompare(a.created_at);

async function fetchLatest() {
  const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(PAGE);
  return data;
}

function upsert(list: ChatMessage[], row: ChatMessage) {
  const rest = list.filter((m) => m.id !== row.id);
  return [row, ...rest].sort(newestFirst);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { household, me, partner, updateMe } = useHousehold();
  const showShopping = household?.chat_show_shopping ?? true;
  const showEvents = household?.chat_show_events ?? true;
  const showDocuments = household?.chat_show_documents ?? true;
  const householdId = household?.id;
  const myId = me?.user_id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  /** Horodatage du dernier signal "écrit…" du partenaire (null = n'écrit pas). */
  const [typingSince, setTypingSince] = useState<string | null>(null);

  const presenceRef = useRef<RealtimeChannel | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  const apply = useCallback((data: Message[] | null) => {
    if (data) {
      setMessages((prev) => [...prev.filter((m) => m.pending), ...data].sort(newestFirst));
      setHasMore(data.length === PAGE);
    }
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    if (householdId) apply(await fetchLatest());
  }, [householdId, apply]);

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    fetchLatest().then((data) => {
      if (!cancelled) apply(data);
    });
    return () => {
      cancelled = true;
    };
  }, [householdId, apply]);

  // Nouveaux messages + cartes "articles ajoutés" mises à jour.
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`messages:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `household_id=eq.${householdId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          setMessages((prev) => upsert(prev, payload.new as Message));
        },
      )
      // Suppressions faites sur l'autre téléphone (seul l'id est transmis).
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const id = (payload.old as Partial<Message>).id;
        if (id) setMessages((prev) => prev.filter((m) => m.id !== id));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, load]);

  // Présence (en ligne) et "en train d'écrire" sur un canal privé protégé par RLS.
  const partnerId = partner?.user_id;
  useEffect(() => {
    if (!householdId || !myId) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase.channel(`household:${householdId}`, {
        config: { private: true, presence: { key: myId } },
      });
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel?.presenceState() ?? {};
          setPartnerOnline(!!partnerId && partnerId in state);
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (payload?.user_id !== partnerId) return;
          setTypingSince(payload.typing ? new Date().toISOString() : null);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          if (payload.typing) typingTimer.current = setTimeout(() => setTypingSince(null), 5000);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') await channel?.track({ online_at: new Date().toISOString() });
        });
      presenceRef.current = channel;
    })();

    return () => {
      cancelled = true;
      presenceRef.current = null;
      if (channel) supabase.removeChannel(channel);
    };
  }, [householdId, myId, partnerId]);

  // Un message reçu du partenaire après le signal efface l'indicateur "écrit…".
  const newest = messages[0];
  const partnerTyping =
    !!typingSince && !(newest && newest.sender_id === partnerId && newest.created_at >= typingSince);

  // Cartes masquées par les réglages de la caz (Réglages › Chat).
  const visible = useMemo(
    () =>
      messages.filter(
        (m) => (m.kind !== 'items_added' || showShopping) && (m.kind !== 'event_added' || showEvents) &&
          ((m.kind !== 'document_added' && m.kind !== 'document_expiring') || showDocuments),
      ),
    [messages, showShopping, showEvents, showDocuments],
  );

  const unreadCount = useMemo(() => {
    if (!me) return 0;
    return visible.filter((m) => m.sender_id !== me.user_id && m.created_at > me.last_read_at).length;
  }, [visible, me]);

  const value: ChatContextValue = {
    loading,
    messages: visible,
    hasMore,
    unreadCount,
    lastMessage: visible[0] ?? null,
    partnerOnline,
    partnerTyping,
    async loadMore() {
      const oldest = messages[messages.length - 1];
      if (!oldest || !hasMore) return;
      const { data } = await supabase
        .from('messages')
        .select('*')
        .lt('created_at', oldest.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (data) {
        setMessages((prev) => [...prev, ...data.filter((d) => !prev.some((p) => p.id === d.id))]);
        setHasMore(data.length === PAGE);
      }
    },
    async send(raw) {
      const body = raw.trim();
      if (!body || !householdId || !myId) return;
      const tempId = `tmp-${Date.now()}`;
      const temp: ChatMessage = {
        id: tempId,
        household_id: householdId,
        sender_id: myId,
        kind: 'text',
        body,
        meta: {},
        created_at: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => [temp, ...prev]);
      presenceRef.current?.send({ type: 'broadcast', event: 'typing', payload: { user_id: myId, typing: false } });
      lastTypingSent.current = 0;

      const { data, error } = await supabase
        .from('messages')
        .insert({ household_id: householdId, sender_id: myId, body })
        .select()
        .single();
      setMessages((prev) => {
        const rest = prev.filter((m) => m.id !== tempId);
        return data ? upsert(rest, data) : rest;
      });
      if (error) throw error;
      updateMe({ last_read_at: data.created_at });
    },
    async remove(id) {
      if (id.startsWith('tmp-')) return;
      const before = messages;
      setMessages((prev) => prev.filter((m) => m.id !== id));
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) {
        setMessages(before);
        throw error;
      }
    },
    async clearAll() {
      if (!householdId) return;
      const before = messages;
      setMessages([]);
      setHasMore(false);
      const { error } = await supabase.from('messages').delete().eq('household_id', householdId);
      if (error) {
        setMessages(before);
        throw error;
      }
    },
    markRead() {
      if (!me || !newest) return;
      if (newest.created_at > me.last_read_at && !newest.pending) {
        updateMe({ last_read_at: newest.created_at });
      }
    },
    notifyTyping() {
      const now = Date.now();
      if (!myId || now - lastTypingSent.current < 2500) return;
      lastTypingSent.current = now;
      presenceRef.current?.send({ type: 'broadcast', event: 'typing', payload: { user_id: myId, typing: true } });
    },
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat doit être utilisé dans <ChatProvider>');
  return ctx;
}
