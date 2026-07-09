// OIDC configuration — the single source of truth for the Keycloak client, read
// from server-only env. Public browsing never touches this (§2, §6): identity
// gates contribution only.
//
// DROP-IN CONTRACT: when all three vars are set (i.e. the platform Keycloak IdP
// exists and this app is registered), `keycloakConfigured()` flips true and the
// contributor seam switches from the provisional cookie to real OIDC. When they
// are unset, behavior is exactly as before — so nothing turns on by accident.

export interface OidcConfig {
  /** e.g. https://id.beauaccess.org/realms/bas — the token issuer. */
  issuer: string;
  /** the public client id registered for Access Atlas. */
  clientId: string;
  /** must equal this app's /api/auth/callback URL, registered on the client. */
  redirectUri: string;
}

/** The validated OIDC config, or null when any var is missing (= not configured). */
export function getOidcConfig(): OidcConfig | null {
  const issuer = import.meta.env.KEYCLOAK_ISSUER?.trim();
  const clientId = import.meta.env.KEYCLOAK_CLIENT_ID?.trim();
  const redirectUri = import.meta.env.KEYCLOAK_REDIRECT_URI?.trim();
  if (!issuer || !clientId || !redirectUri) return null;
  return {
    // Normalize: no trailing slash, so `${issuer}/.well-known/...` is clean.
    issuer: issuer.replace(/\/+$/, ''),
    clientId,
    redirectUri,
  };
}

/** True once the platform Keycloak IdP is stood up and this app is configured. */
export function keycloakConfigured(): boolean {
  return getOidcConfig() !== null;
}

/** Auth cookies must be Secure on https origins; local http dev must not be. */
export function cookieSecure(config: OidcConfig): boolean {
  return config.redirectUri.startsWith('https://');
}
