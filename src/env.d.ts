/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  // Server-only (never exposed to the client).
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  // Must be exactly 'true' to accept contributions before real auth exists.
  // Local/preview ONLY — never set in production.
  readonly ALLOW_PROVISIONAL_CONTRIBUTIONS?: string;
  // Keycloak OIDC (server-only). Set ALL THREE to switch contribution from the
  // provisional cookie to real auth (src/lib/auth/config.ts). Unset until the
  // platform IdP is stood up → provisional/gated behavior unchanged.
  readonly KEYCLOAK_ISSUER?: string;
  readonly KEYCLOAK_CLIENT_ID?: string;
  readonly KEYCLOAK_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
