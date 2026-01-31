import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error("Supabase env vars missing (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)");
  }

  cachedClient = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  return cachedClient;
}
