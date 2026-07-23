# Deploy runbook — DigitalOcean App Platform

How Access Atlas goes live on DigitalOcean: the Astro app + Keycloak on App
Platform, app data on a Supabase **cloud** project. Decision shape chosen
2026-07-10 (owner): App Platform + Supabase cloud, full stack, provision via
`doctl`. Spec: [`.do/app.yaml`](../.do/app.yaml). Image: [`Dockerfile`](../Dockerfile)
(verified: builds, boots, serves, carries no service-role key).

> **Why this order:** the app's server config is read from `process.env` at
> runtime (commit "Read server-only config/secrets from process.env at runtime"),
> so the production URL and secrets are injected at deploy time — no rebuild to
> point at prod, and no secret baked into the image.

## What only you can do (the two manual gates)

1. **Create the Supabase cloud project** — App Platform can't provision it (different
   vendor). At <https://supabase.com>: New Project (region near NYC) → from
   **Settings → API** copy the **Project URL**, the **publishable** (`sb_publishable_…`,
   anon-equivalent) key, and the **secret** (`sb_secret_…`, service-role-equivalent) key.
   Then set up the schema — **zero DB credentials needed**:
   ```
   # Dashboard → SQL Editor → New query → paste supabase/provision-cloud.sql → Run.
   # That file is migrations 0001-0007 + the attribute catalog, NO demo data.
   # (Alternative if you prefer the CLI: npx supabase link --project-ref <ref>
   #  && npx supabase db push — needs a Supabase access token + the DB password.)
   ```
   Then import the reviewed seed batches against the cloud project (needs the
   secret key as SUPABASE_SERVICE_ROLE_KEY):
   ```
   PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_... \
     npm run seed:import -- research/seed-nys/wny-2026-07.seed.json
   # repeat for wny-2026-07b.seed.json (batch 2); batch 3 (…c) after its import decision.
   ```

   > **New key format note:** this project began on local Supabase's legacy
   > `anon`/`service_role` JWT keys; the cloud project uses the newer
   > `sb_publishable_…` / `sb_secret_…` keys. `@supabase/supabase-js` passes the key
   > string through unchanged, and the publishable key was verified against the live
   > REST API — so no code change is needed; just use the new keys in the env slots.
2. **Authorize DigitalOcean ↔ GitHub** (once): DO console → Apps → the GitHub
   authorization prompt, granting access to `Beaudoin0zach/access-atlas`. (Skip if
   you'd rather deploy from a container image pushed to DOCR — ask and I'll switch
   the spec to `image:` from `github:`.)

## Provision (doctl)

```
# 1. Create the app with the spec; supply secret values inline (encrypted at rest).
doctl apps create --spec .do/app.yaml

# 2. Set the secret env values (or paste them in the DO console the first time):
#    web:  PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
#    keycloak: KC_BOOTSTRAP_ADMIN_USERNAME, KC_BOOTSTRAP_ADMIN_PASSWORD
doctl apps update <app-id> --spec .do/app.yaml   # after editing secrets in-place

# 3. Watch the first deploy:
doctl apps list
doctl apps logs <app-id> web --follow
doctl apps logs <app-id> keycloak --follow
```

## Database migrations (PRE_DEPLOY job)

Every deploy runs a **`migrate` PRE_DEPLOY job** (`.do/app.yaml` `jobs:`, image
`.do/migrate.Dockerfile`) BEFORE the new `web` version is promoted. It runs
`supabase db push` (`scripts/migrate-deploy.sh`), which applies only the
`supabase/migrations/*.sql` that aren't yet in the remote
`supabase_migrations.schema_migrations` table — the same tool and tracking table
local `supabase db reset` uses, so prod can't drift from the repo. This is the
analog of CIT's `prisma migrate deploy`.

**Why it exists:** without it, `deploy_on_push` shipped *code* but never the
*schema*, so a push whose code assumed an unapplied migration 500'd the list
pages (2026-07-23: `getListings` selected `listings.coords_source` before
migration `0011` had been applied to prod). A PRE_DEPLOY job that exits non-zero
**halts the deploy**, so a failed or skipped migration now stops the rollout
instead of serving code against an un-migrated database.

**One-time setup — a new secret is required:**

```
# SUPABASE_DB_URL — the SESSION-mode pooler connection string (port 5432),
# percent-encoded. Get it from: Supabase dashboard -> Project Settings ->
# Database -> Connection string -> "Session pooler". Do NOT use the transaction
# pooler (port 6543): it doesn't support all migration statements. The direct
# db.<ref>.supabase.co host is IPv6-only and may be unreachable from App Platform.
#
# 1. Set the secret on the app (encrypted at rest), THEN apply the spec:
doctl apps update <app-id> --spec .do/app.yaml    # adds the `migrate` job
# 2. If you apply the spec before setting SUPABASE_DB_URL, the next deploy will
#    (by design) fail at the migrate job with a clear message — set the secret
#    and redeploy.
```

The existing prod DB was reconciled and its migration history baselined on
2026-07-23 (all of `0001`–`0011` recorded as applied), so the first run of this
job is a no-op; only new migrations apply thereafter.

**Manual / local equivalents** (operator sets `SUPABASE_DB_URL` in the env):

```
npm run migrate:check     # dry run: list pending migrations, apply none
npm run migrate:deploy    # apply pending migrations
```

## Resolve the two URL couplings (after the first deploy assigns URLs)

App Platform assigns `https://<name>-<hash>.ondigitalocean.app` URLs that aren't
known until the app exists. The spec wires them with `${APP_URL}` /
`${keycloak.PUBLIC_URL}`, but two things must line up on the Keycloak side:

- **Realm client redirect URI** must equal `${APP_URL}/api/auth/callback`. The
  first deploy imports a realm whose `access-atlas` client allows a wildcard
  (`https://*.ondigitalocean.app/api/auth/callback`); once the app URL is known,
  tighten it to the exact URL in the Keycloak admin console (Clients → access-atlas
  → Valid redirect URIs). Wildcard is acceptable for staging, not for production.
- **`KC_HOSTNAME`** must equal Keycloak's assigned public URL (the spec sets this
  from `${keycloak.PUBLIC_URL}`). If discovery returns the wrong issuer, this is
  the knob.

A production realm export (`docker/keycloak/realm-access-atlas.prod.json`, https
redirect URIs, no test user, pairwise subject type per docs/platform-membership.md)
should replace the dev realm before external traffic. The local dev realm
(`docker/keycloak/realm-access-atlas.json`) is localhost-only.

## Verify live (same checks proven locally)

Drive the contributor flow against the deployed URLs and confirm: `/api/auth/login`
→ Keycloak → `/api/auth/callback` mints an httpOnly session; `/account/` resolves it;
logout revokes it. The **homepage** must serve before any of that (it needs no
backend). Note `/places/` and `/providers/` DO query the database — they 500 if
the schema is behind (the reason the migrate job above exists), so treat a 200 on
those as part of verifying the DB, not a backend-free liveness check.

## Cost (recurring, approximate)

| Resource | ~Monthly |
|---|---|
| App Platform `web` (apps-s-1vcpu-0.5gb) | ~$5 |
| App Platform `keycloak` (apps-s-1vcpu-1gb) | ~$12 |
| Managed Postgres (dev, for Keycloak) | ~$7 |
| Supabase cloud | Free tier to start; ~$25 at Pro |
| **DigitalOcean total** | **~$24/mo** (Supabase separate) |

Bandwidth/build minutes are included at low volume. A staging deploy does not
pre-empt the §13 org/entity hosting decision; a production commitment does.

## TestFlight coupling

Once the app has a stable HTTPS origin, set it as `server.url` in
`capacitor.config.ts` — that's the webview target the iOS wrapper loads
(docs/ios-testflight.md). Internal TestFlight becomes reachable at that point.
