import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

let client: SupabaseClient | null = null;

/**
 * Cliente Supabase singleton. Requiere SUPABASE_URL y SUPABASE_KEY en entorno.
 * Usar para tenants, canchas, metadatos de partidos y políticas RLS del lado servidor.
 */
export function getSupabase(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new Error(
      'Supabase no configurado: defina SUPABASE_URL y SUPABASE_KEY en .env',
    );
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
