// POST /api/listings — submit a new place or provider (the one shared flow,
// §13). On-demand. Same hard write-gate and contributor seam as confirmations.
//
// A new listing starts as "self-reported / awaiting verification" (§4): the
// submitter may self-report which attributes they observed, which creates claims
// in the self_reported state (zero confirmations) for the community to confirm.
// The submitter's own assertion is NOT counted as a community confirmation.
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase-server';
import { getAttributeDefinitions } from '../../lib/repo';
import { resolveContributor } from '../../lib/contributor';

export const prerender = false;

const MAX_NAME = 200;
const MAX_SUMMARY = 1000;

function backToForm(kind: string, status: string) {
  const k = kind === 'provider' ? 'provider' : 'place';
  return new Response(null, {
    status: 303,
    headers: { Location: `/contribute/submit/?kind=${k}&status=${status}` },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const form = await request.formData().catch(() => null);
  const kindRaw = form?.get('kind');
  const kind = kindRaw === 'provider' ? 'provider' : kindRaw === 'place' ? 'place' : null;
  if (!form || !kind) return new Response('Bad request', { status: 400 });

  if (!supabaseAdmin) return backToForm(kind, 'disabled');

  const name = (form.get('name') as string | null)?.trim();
  if (!name) return backToForm(kind, 'need_name');

  try {
    const pseudonym = (form.get('pseudonym') as string | null) ?? null;
    const resolved = await resolveContributor(cookies, supabaseAdmin, { pseudonym });
    if ('gate' in resolved) return backToForm(kind, resolved.gate);
    const contributor = resolved.contributor;

    const str = (k: string, max: number) =>
      (form.get(k) as string | null)?.trim().slice(0, max) || null;

    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('listings')
      .insert({
        kind,
        name: name.slice(0, MAX_NAME),
        summary: str('summary', MAX_SUMMARY),
        street: str('street', MAX_NAME),
        city: str('city', MAX_NAME),
        region: str('region', MAX_NAME),
        postal_code: str('postal_code', 20),
        // Representation (§12) applies to both kinds — it lives on the listing.
        disabled_owned: form.get('disabled_owned') != null,
        disabled_led: form.get('disabled_led') != null,
        submitted_by: contributor.id,
      })
      .select('id')
      .single();
    if (listingErr || !listing) return backToForm(kind, 'error');

    if (kind === 'provider') {
      // provider_profiles carries only provider-specific competence now (§8).
      const { error } = await supabaseAdmin.from('provider_profiles').insert({
        listing_id: listing.id,
        disability_literate: form.get('disability_literate') != null,
      });
      if (error) return backToForm(kind, 'error');
    }

    // Self-reported attribute claims. Only keys valid for this kind are honored.
    const chosen = new Set(form.getAll('attributes').map(String));
    if (chosen.size > 0) {
      const valid = await getAttributeDefinitions(kind);
      const keys = valid.filter((d) => chosen.has(d.key)).map((d) => d.key);
      if (keys.length > 0) {
        const { data: defs } = await supabaseAdmin
          .from('attribute_definitions')
          .select('id, key')
          .in('key', keys);
        const claims = (defs ?? []).map((d: { id: string }) => ({
          listing_id: listing.id,
          attribute_def_id: d.id,
          asserted_value: true,
        }));
        if (claims.length > 0) {
          // Ignore duplicate-claim races; the listing + others still succeed.
          await supabaseAdmin.from('attribute_claims').insert(claims);
        }
      }
    }

    const path = kind === 'provider' ? 'providers' : 'places';
    return new Response(null, {
      status: 303,
      headers: { Location: `/${path}/${listing.id}/?submitted=1` },
    });
  } catch {
    return backToForm(kind, 'error');
  }
};
