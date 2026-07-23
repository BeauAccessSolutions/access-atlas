// The one vocabulary for visit-report outcome banners (§4/§5 — honest,
// plain-language). Shared by the per-claim confirm page and the first-report
// page so the two doors into /api/confirmations never drift apart. `alert` is
// for problems the person must fix; `status` for outcomes/notices.
export interface VisitBanner {
  role: 'status' | 'alert';
  text: string;
}

export const VISIT_BANNERS: Record<string, VisitBanner> = {
  thanks: { role: 'status', text: 'Thank you — your visit was recorded. It counts toward this claim once enough independent visits agree.' },
  already: { role: 'status', text: "You've already reported this claim. Each person can report a given claim once (that's what keeps the count independent)." },
  need_answer: { role: 'alert', text: 'Please choose whether your visit confirmed the claim or not.' },
  photo_required: { role: 'alert', text: 'A photo is required to confirm this attribute. (You can dissent without one.)' },
  photo_too_big: { role: 'alert', text: 'That photo is too large — please use one under 10 MB.' },
  alt_required: { role: 'alert', text: 'Please describe what your photo shows — the description is what makes it evidence for blind and low-vision users.' },
  notfound: { role: 'alert', text: 'That claim could not be found.' },
  disabled: { role: 'status', text: 'Contributions are not open yet — the community sign-in is still being set up. Your report was not saved.' },
  need_signin: { role: 'alert', text: 'Please sign in to contribute — your report was not saved.' },
  auth_error: { role: 'alert', text: 'Sign-in did not complete. Please try again.' },
  error: { role: 'alert', text: 'Something went wrong and your report was not saved. Please try again.' },
};
