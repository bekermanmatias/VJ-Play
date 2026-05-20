import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(env.supabase.url, env.supabase.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cached;
}
