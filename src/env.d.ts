/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  // Server-only (never exposed to the client).
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  // Must be exactly 'true' to accept contributions before real auth exists.
  // Local/preview ONLY — never set in production.
  readonly ALLOW_PROVISIONAL_CONTRIBUTIONS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
