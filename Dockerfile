# Production image for the Astro (node-standalone) app. Multi-stage so the
# runtime image carries only production deps + the built server — no devDeps,
# no source. Server-only config/secrets are read from process.env at RUNTIME
# (see astro.config.mjs / src/lib/supabase-server.ts), so NOTHING secret is
# baked here; the platform injects env at deploy time.

# ---- builder: install everything, build ------------------------------------
FROM node:22-slim AS builder
WORKDIR /app
# sharp (evidence-photo thumbnails) needs build tooling for its native binary.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The public hostname(s) this app is served from, for Astro's CSRF origin check.
# This MUST be a build ARG: astro.config.mjs bakes `security.allowedDomains` into
# the manifest at BUILD time, so a run-time-only variable arrives too late and
# the setting is silently inert. Without it Astro distrusts the proxy's
# X-Forwarded-Host, computes its own origin as `https://localhost`, and rejects
# EVERY browser form POST with "Cross-site POST form submissions are forbidden"
# — which is exactly what production did from launch until 2026-07-26.
# A public hostname is not a secret, so baking it does not touch the §6
# no-secrets-in-the-image rule. Empty default = today's local-dev behavior.
ARG SITE_ORIGINS=""
ENV SITE_ORIGINS=$SITE_ORIGINS
RUN npm run build

# ---- runner: production deps + built output only ---------------------------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Astro's node adapter honors HOST/PORT; App Platform sets PORT. Bind all ifaces.
ENV HOST=0.0.0.0
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
# App Platform overrides PORT; 4321 is the local default.
EXPOSE 4321
# Run as the non-root user the node image ships.
USER node
CMD ["node", "./dist/server/entry.mjs"]
