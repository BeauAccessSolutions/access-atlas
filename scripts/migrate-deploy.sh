#!/usr/bin/env sh
# migrate-deploy.sh — apply pending Supabase migrations to the target database
# BEFORE the new app version goes live.
#
# Wired as a DigitalOcean App Platform PRE_DEPLOY job (see .do/app.yaml `jobs:`),
# so a push whose code assumes a not-yet-applied migration can't reach users
# against an un-migrated database — the exact failure that 500'd the list pages
# on 2026-07-23 (getListings selected listings.coords_source before migration
# 0011 had ever been applied to prod).
#
# Mechanism: `supabase db push` compares supabase/migrations/*.sql against the
# remote supabase_migrations.schema_migrations table and applies ONLY what's
# missing, each in its own transaction. It is the same tool and the same
# tracking table that local `supabase db reset` uses, so prod cannot drift from
# the repo and there is no second migration runner to keep in sync (§11).
#
# FAIL-CLOSED: if SUPABASE_DB_URL is unset we exit NON-ZERO rather than skip. A
# PRE_DEPLOY job that exits non-zero halts the deploy, so a missing/misconfigured
# secret stops the rollout instead of silently shipping code ahead of the schema
# (the `; exit 0` landmine called out in the platform tracker §2c). db push
# itself also exits non-zero on any failing migration, halting the deploy the
# same way.
#
# Usage:
#   scripts/migrate-deploy.sh              apply pending migrations
#   scripts/migrate-deploy.sh --dry-run    print pending migrations, apply none
set -eu

# Pin the CLI so the job is reproducible (npm-pinned; no GitHub asset-name
# guessing). Keep this in step with the version the repo develops against.
SUPABASE_CLI="supabase@2.109.1"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "migrate-deploy: SUPABASE_DB_URL is not set - refusing to deploy against an unknown/un-migrated database." >&2
  echo "  Set it as a SECRET on the app: Supabase dashboard -> Project Settings -> Database ->" >&2
  echo "  Connection string -> the SESSION-mode pooler URI (port 5432), percent-encoded." >&2
  echo "  (Transaction pooler on 6543 does NOT support all migration statements.)" >&2
  exit 1
fi

# Drift-check mode: report what WOULD apply, change nothing.
if [ "${1:-}" = "--dry-run" ] || [ "${1:-}" = "--check" ]; then
  echo "migrate-deploy: DRY RUN - pending migrations (not applying):"
  exec npx --yes "$SUPABASE_CLI" db push --db-url "$SUPABASE_DB_URL" --dry-run
fi

echo "migrate-deploy: applying pending migrations to the remote database..."
npx --yes "$SUPABASE_CLI" db push --db-url "$SUPABASE_DB_URL" --yes
echo "migrate-deploy: migrations up to date."
