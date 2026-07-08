// Shared helper for ops scripts (seed import, data-rights). Standalone Node —
// these run OUTSIDE the Astro runtime, so they read process.env directly and
// build their own service-role Supabase client.
//
// SECURITY: this uses the SERVICE-ROLE key, which bypasses RLS (§6). It is for
// trusted local/ops use only — never expose these scripts to the web. Same trust
// level as src/lib/supabase-server.ts, different entry point.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

// Minimal .env loader — no dependency, works on any Node 20. Only sets keys that
// aren't ALREADY in the environment, so real env vars (CI) win over the file.
export function loadDotenv(path = resolve(REPO_ROOT, '.env')) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return; // no .env is fine if the vars are already exported
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // Strip matched surrounding quotes.
    if (val.length >= 2 && ((val[0] === '"' && val.at(-1) === '"') || (val[0] === "'" && val.at(-1) === "'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

// Build the trusted service-role client, or exit with a clear message. We reuse
// the SAME env var names the app uses (PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY) so there's one place to configure a backend.
export function serviceClient() {
  loadDotenv();
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      'Missing PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.\n' +
        'Set them in .env (see .env.example) or export them, then re-run.\n' +
        'Tip: `npm run db:start` boots a local Supabase and prints these.',
    );
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Tiny arg parser: returns { _: [positionals], flag: true/'value' }.
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) out[a.slice(2, eq)] = a.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
      else out[a.slice(2)] = true;
    } else {
      out._.push(a);
    }
  }
  return out;
}
