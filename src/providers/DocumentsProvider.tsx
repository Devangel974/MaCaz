import * as IntentLauncher from 'expo-intent-launcher';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
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
import { AppState, Platform } from 'react-native';

import type { DocType, HouseDocument } from '@/lib/database.types';
import { buildFile, cacheFileFor, type Draft, parseDate, toArrayBuffer } from '@/lib/documents';
import { syncDocumentReminders } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';

import { useEvents } from './EventsProvider';
import { useHousehold } from './HouseholdProvider';

const BUCKET = 'documents';
const THUMB_TTL = 60 * 60; // 1 h
const FILE_TTL = 60; // lien d'accès au PDF : 60 s

export type DocumentInput = {
  title: string;
  doc_type: DocType;
  owner_user: string | null;
  expires_at: string | null;
  remind_days: number[];
  notes: string | null;
  /** Créer / garder l'événement « Renouveler … » dans l'agenda. */
  addToAgenda: boolean;
};

type DocumentsContextValue = {
  loading: boolean;
  documents: HouseDocument[];
  byId: (id: string | undefined) => HouseDocument | null;
  thumbs: Record<string, string>;
  /** Verrou biométrique de l'onglet Papiers (par téléphone). */
  unlocked: boolean;
  unlock: () => Promise<boolean>;
  /** À appeler autour d'une action qui quitte l'appli (appareil photo, galerie…) pour ne pas reverrouiller. */
  keepUnlocked: <T>(fn: () => Promise<T>) => Promise<T>;
  save: (input: DocumentInput, draft: Draft, existing?: HouseDocument | null) => Promise<HouseDocument>;
  remove: (doc: HouseDocument) => Promise<void>;
  open: (doc: HouseDocument) => Promise<void>;
  share: (doc: HouseDocument) => Promise<void>;
};

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

const byTitle = (a: HouseDocument, b: HouseDocument) => a.title.localeCompare(b.title, 'fr');

async function fetchDocuments() {
  const { data, error } = await supabase.from('documents').select('*').order('title');
  if (error) console.warn('[papiers] chargement', error.message);
  return data;
}

/** Date de l'événement « Renouveler … » : au plus grand rappel (6 mois par défaut). */
function agendaDate(input: Pick<DocumentInput, 'expires_at' | 'remind_days'>) {
  const exp = parseDate(input.expires_at);
  if (!exp) return null;
  const lead = Math.max(0, ...input.remind_days);
  return new Date(exp.getFullYear(), exp.getMonth(), exp.getDate() - lead);
}

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  const { create: createEvent, update: updateEvent, remove: removeEvent, byId: eventById } = useEvents();
  const householdId = household?.id;

  const [documents, setDocuments] = useState<HouseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [unlocked, setUnlocked] = useState(false);
  const external = useRef(0);

  const apply = useCallback((data: HouseDocument[] | null) => {
    if (data) setDocuments(data);
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    if (householdId) apply(await fetchDocuments());
  }, [householdId, apply]);

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    fetchDocuments().then((data) => {
      if (!cancelled) apply(data);
    });
    // Cartes « … expire bientôt » dans le chat : idempotent côté serveur.
    supabase.rpc('check_document_alerts').then(({ error }) => {
      if (error) console.warn('[papiers] alertes', error.message);
    });
    return () => {
      cancelled = true;
    };
  }, [householdId, apply]);

  // Temps réel
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`documents:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents', filter: `household_id=eq.${householdId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as HouseDocument;
          setDocuments((prev) => [...prev.filter((d) => d.id !== row.id), row].sort(byTitle));
        },
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'documents' }, (payload) => {
        const id = (payload.old as Partial<HouseDocument>).id;
        if (id) setDocuments((prev) => prev.filter((d) => d.id !== id));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, load]);

  // Miniatures : liens signés valables 1 h.
  const thumbKey = documents.map((d) => `${d.id}:${d.thumb_path ?? ''}`).join('|');
  useEffect(() => {
    const withThumb = documents.filter((d) => d.thumb_path);
    if (!withThumb.length) return;
    let cancelled = false;
    supabase.storage
      .from(BUCKET)
      .createSignedUrls(
        withThumb.map((d) => d.thumb_path as string),
        THUMB_TTL,
      )
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<string, string> = {};
        data.forEach((r, i) => {
          if (r.signedUrl) map[withThumb[i].id] = r.signedUrl;
        });
        setThumbs(map);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcul seulement si les miniatures changent
  }, [thumbKey]);

  // Rappels locaux d'expiration (sur les deux téléphones)
  useEffect(() => {
    if (!loading) syncDocumentReminders(documents);
  }, [documents, loading]);

  // Verrou : on reverrouille dès que l'appli passe en arrière-plan,
  // sauf pendant une action qui ouvre une autre appli (appareil photo, galerie, lecteur PDF).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && external.current === 0) setUnlocked(false);
    });
    return () => sub.remove();
  }, []);

  const keepUnlocked = useCallback(async <T,>(fn: () => Promise<T>) => {
    external.current += 1;
    try {
      return await fn();
    } finally {
      // l'appli revient au premier plan juste après : on laisse passer l'événement
      setTimeout(() => {
        external.current = Math.max(0, external.current - 1);
      }, 1500);
    }
  }, []);

  const unlock = useCallback(async () => {
    if (Platform.OS === 'web') {
      setUnlocked(true);
      return true;
    }
    const [hasHardware, level] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);
    // Téléphone sans aucun verrou (ni empreinte ni code) : rien à demander.
    if (!hasHardware && level === LocalAuthentication.SecurityLevel.NONE) {
      setUnlocked(true);
      return true;
    }
    const res = await keepUnlocked(() =>
      LocalAuthentication.authenticateAsync({
        promptMessage: 'Déverrouiller les papiers',
        cancelLabel: 'Annuler',
        disableDeviceFallback: false,
      }),
    );
    if (res.success) setUnlocked(true);
    return res.success;
  }, [keepUnlocked]);

  const downloadToCache = useCallback(async (doc: HouseDocument) => {
    if (!doc.file_path) throw new Error('Ce papier n’a pas encore de fichier.');
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, FILE_TTL);
    if (error || !data) throw error ?? new Error('Lien indisponible');
    return File.downloadFileAsync(data.signedUrl, cacheFileFor(doc.title));
  }, []);

  const syncAgenda = useCallback(
    async (input: DocumentInput, current: HouseDocument | null): Promise<string | null> => {
      const date = agendaDate(input);
      const existingEventId = current?.agenda_event_id ?? null;
      // L'agenda local ne garde que 30 jours d'historique : on vérifie aussi en base.
      const existingEvent =
        existingEventId &&
        (eventById(existingEventId) ??
          (await supabase.from('events').select('id').eq('id', existingEventId).maybeSingle()).data);
      if (!input.addToAgenda || !date) {
        if (existingEventId) await removeEvent(existingEventId).catch(() => undefined);
        return null;
      }
      const payload = {
        title: `Renouveler : ${input.title}`,
        starts_at: date.toISOString(),
        ends_at: null,
        all_day: true,
        for_user: input.owner_user,
        location: null,
        reminder_minutes: 0,
      };
      if (existingEventId && existingEvent) {
        await updateEvent(existingEventId, payload);
        return existingEventId;
      }
      const ev = await createEvent(payload);
      return ev.id;
    },
    [createEvent, updateEvent, removeEvent, eventById],
  );

  const value = useMemo<DocumentsContextValue>(
    () => ({
      loading,
      documents,
      byId: (id) => documents.find((d) => d.id === id) ?? null,
      thumbs,
      unlocked,
      unlock,
      keepUnlocked,
      async save(input, draft, existing) {
        if (!householdId) throw new Error('Pas de caz');
        const fields = {
          title: input.title,
          doc_type: input.doc_type,
          owner_user: input.owner_user,
          expires_at: input.expires_at,
          remind_days: [...new Set(input.remind_days)].sort((a, b) => b - a),
          notes: input.notes,
        };

        // 1. La fiche (pour obtenir l'id avant d'envoyer les fichiers)
        let doc: HouseDocument;
        if (existing) {
          const { data, error } = await supabase.from('documents').update(fields).eq('id', existing.id).select().single();
          if (error) throw error;
          doc = data;
        } else {
          const { data, error } = await supabase
            .from('documents')
            .insert({ ...fields, household_id: householdId })
            .select()
            .single();
          if (error) throw error;
          doc = data;
        }

        // 2. Le PDF (+ miniature) si de nouvelles pages ont été fournies
        const built = await buildFile(draft);
        if (built) {
          const stamp = Date.now();
          const base = `${householdId}/${doc.id}`;
          const filePath = `${base}/papier-${stamp}.pdf`;
          const thumbPath = built.thumb ? `${base}/apercu-${stamp}.jpg` : null;
          const up = await supabase.storage
            .from(BUCKET)
            .upload(filePath, toArrayBuffer(built.pdf), { contentType: 'application/pdf' });
          if (up.error) throw up.error;
          if (built.thumb && thumbPath) {
            await supabase.storage
              .from(BUCKET)
              .upload(thumbPath, toArrayBuffer(built.thumb), { contentType: 'image/jpeg' });
          }
          const old = [existing?.file_path, existing?.thumb_path].filter((p): p is string => !!p);
          const { data, error } = await supabase
            .from('documents')
            .update({
              file_path: filePath,
              thumb_path: thumbPath,
              page_count: built.pageCount,
              size_bytes: built.pdf.byteLength,
            })
            .eq('id', doc.id)
            .select()
            .single();
          if (error) throw error;
          doc = data;
          if (old.length) await supabase.storage.from(BUCKET).remove(old);
        }

        // 3. L'événement « Renouveler … » dans l'agenda
        const eventId = await syncAgenda(input, existing ?? null);
        if (eventId !== doc.agenda_event_id) {
          const { data } = await supabase
            .from('documents')
            .update({ agenda_event_id: eventId })
            .eq('id', doc.id)
            .select()
            .single();
          if (data) doc = data;
        }

        setDocuments((prev) => [...prev.filter((d) => d.id !== doc.id), doc].sort(byTitle));
        // Un seuil a peut-être déjà été franchi (papier qui expire bientôt)
        supabase.rpc('check_document_alerts');
        return doc;
      },
      async remove(doc) {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        const files = [doc.file_path, doc.thumb_path].filter((p): p is string => !!p);
        if (files.length) await supabase.storage.from(BUCKET).remove(files);
        if (doc.agenda_event_id) await removeEvent(doc.agenda_event_id).catch(() => undefined);
        const { error } = await supabase.from('documents').delete().eq('id', doc.id);
        if (error) {
          load();
          throw error;
        }
      },
      async open(doc) {
        const file = await downloadToCache(doc);
        try {
          await keepUnlocked(() =>
            IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data: file.contentUri,
              type: 'application/pdf',
              flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
            }),
          );
        } catch {
          // Pas de lecteur PDF installé : on passe par le menu de partage.
          await keepUnlocked(() => Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: doc.title }));
        }
      },
      async share(doc) {
        const file = await downloadToCache(doc);
        await keepUnlocked(() =>
          Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: doc.title, UTI: 'com.adobe.pdf' }),
        );
      },
    }),
    [loading, documents, thumbs, unlocked, unlock, keepUnlocked, householdId, syncAgenda, removeEvent, load, downloadToCache],
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments() {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments doit être utilisé dans <DocumentsProvider>');
  return ctx;
}
