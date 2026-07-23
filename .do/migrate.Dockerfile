# PRE_DEPLOY migration-job image (referenced by .do/app.yaml `jobs:`).
#
# Deliberately SEPARATE from the web Dockerfile: the web runtime image must stay
# lean and must NOT carry migrations or the Supabase CLI. This tiny image exists
# only to run `supabase db push` against the prod database once per deploy,
# before the new web version goes live.
#
# `supabase db push` reads supabase/config.toml + supabase/migrations/*.sql
# relative to the working directory, so we copy the whole supabase/ tree. The
# CLI itself is fetched (pinned) by npx at run time inside scripts/migrate-deploy.sh.
FROM node:22-slim
WORKDIR /app

COPY supabase ./supabase
COPY scripts/migrate-deploy.sh ./scripts/migrate-deploy.sh
RUN chmod +x ./scripts/migrate-deploy.sh

# Least privilege: the node image ships a non-root `node` user with a writable
# home for the npx cache.
USER node

CMD ["./scripts/migrate-deploy.sh"]
