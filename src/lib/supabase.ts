// Supabase client — created only when credentials are present. The app is
// designed to render from a local seed (seed.ts) when no DB is attached, so the
// skeleton runs and a11y-tests pass with zero backend. This is a scaffold
// convenience, not a data-layer forever: real data lives in Postgres (§9).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const isDbConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isDbConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: false }, // no-account browsing is the default (§6)
    })
  : null;
