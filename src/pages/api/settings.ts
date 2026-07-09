// POST /api/settings — save (or reset) a visitor's accessibility preferences.
// On-demand. Writes a first-party functional cookie and redirects back to the
// settings page. No account, no client JS, no third party — a pure §5 mechanism.
//
// This cookie is strictly functional (it personalizes the UI the user asked us
// to personalize); it is NOT analytics and never leaves this origin (§6, §14).
import type { APIRoute } from 'astro';
import {
  SETTINGS_COOKIE,
  SETTINGS_COOKIE_MAX_AGE,
  serializeSettings,
  settingsFromForm,
} from '../../lib/settings';

export const prerender = false;

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
} as const;

export const POST: APIRoute = async ({ request, cookies }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return new Response('Bad request', { status: 400 });

  // "Reset to defaults" clears the cookie entirely — the page then renders the
  // built-in defaults, and there's no lingering preference to explain (§6).
  if (form.get('reset') != null) {
    cookies.delete(SETTINGS_COOKIE, { path: '/' });
    return new Response(null, {
      status: 303,
      headers: { Location: '/settings/?status=reset' },
    });
  }

  const value = serializeSettings(settingsFromForm(form));
  cookies.set(SETTINGS_COOKIE, value, { ...COOKIE_OPTS, maxAge: SETTINGS_COOKIE_MAX_AGE });

  // 303 so a refresh doesn't re-POST; the redirected GET re-renders the page
  // with the new settings already applied by Base.astro (the live preview).
  return new Response(null, {
    status: 303,
    headers: { Location: '/settings/?status=saved' },
  });
};
