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
   vendor). At <https://supabase.com>: New Project → note the **Project URL**, the
   **anon** key, and the **service_role** key (Settings → API). Then apply this
   repo's migrations + seed to it:
   ```
   npx supabase link --project-ref <ref>
   npx supabase db push          # applies supabase/migrations/*
   # then import your reviewed seed batches against the cloud project:
   #   PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY set to the cloud project,
   #   npm run seed:import -- research/seed-nys/wny-2026-07.seed.json   (etc.)
   ```
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
logout revokes it. The homepage + `/places/` must serve before any of that (they
need no backend).

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
