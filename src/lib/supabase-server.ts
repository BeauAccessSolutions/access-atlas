// SERVER-ONLY Supabase client, holding the service-role key. NEVER import this
// from a component, an island, or anything that reaches the browser — it would
// leak a key that bypasses RLS. It is imported only by on-demand server routes
// (the contributions endpoint), which run on the Node adapter.
//
// Writes go through this trusted client because contributor auth (Keycloak) is
// not stood up yet, so we cannot yet scope anon writes with RLS (§6). Once the
// IdP lands, writes move to an authenticated contributor and this narrows.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const isWriteBackendConfigured = Boolean(url && serviceKey);

// Null when unconfigured — callers must handle that (the endpoint returns a
// clear "not connected" response rather than crashing).
export const supabaseAdmin: SupabaseClient | null = isWriteBackendConfigured
  ? createClient(url!, serviceKey!, { auth: { persistSession: false } })
  : null;
