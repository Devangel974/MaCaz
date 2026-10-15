import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_KEY manquent : copie .env.example en .env et remplis-le.',
  );
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Rafraîchit le jeton uniquement quand l'appli est au premier plan.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Message d'erreur lisible à partir d'une erreur Supabase / Postgres. */
export function errorMessage(error: unknown): string {
  if (!error) return 'Erreur inconnue';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const msg = error.message;
    if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.';
    if (msg.includes('Email not confirmed')) return 'Confirme ton email avant de te connecter.';
    if (msg.includes('User already registered')) return 'Un compte existe déjà avec cet email.';
    if (msg.includes('Password should be')) return 'Mot de passe trop court (6 caractères minimum).';
    if (msg.includes('Network request failed')) return 'Pas de connexion internet.';
    return msg;
  }
  return 'Erreur inconnue';
}
