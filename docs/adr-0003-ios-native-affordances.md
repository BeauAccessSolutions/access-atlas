# ADR 0003 — A native affordance layer for App Review 4.2

Status: **Proposed** (2026-08-05). To be raised as a **BAS ADR** (§15). Follows
[ADR 0001](adr-0001-nearby-geolocation.md) and
[ADR 0002](adr-0002-native-camera-capture.md); native steps in
[ios-native-affordances.md](ios-native-affordances.md).

## Context

The iOS app is a Capacitor / WKWebView **wrapper** around the hosted site (§13).
External distribution on the **App Store** must clear **Guideline 4.2 (minimum
functionality)** — a wrapper that is "just a website" is rejected.

ADR 0002 added **native camera capture** on the confirm/report flow as the
purpose-built 4.2 differentiator (first-person accessibility evidence, §4). On its
own that is a **weak** 4.2 case, for reasons the camera work can't fix:

1. The camera is the app's **only** native feature, and it sits **behind sign-in**,
   several taps deep in a contribution flow. A reviewer who opens the app — or who
   never signs in — sees a website. Reviewers reject on first impression.
2. The "sort by distance" enhancement (ADR 0001) uses the **web** Geolocation API,
   which works in Mobile Safari too, so it is **not** a native differentiator.
3. The comparison point that just cleared review — **Disability Wiki** — did so with
   a *suite* of native affordances (quick actions, Spotlight, share, Dynamic Type,
   offline bundle), not one feature. Access Atlas is weaker by contrast, and a 4.2
   rejection goes **on record**.

We need a small layer of native behaviour that is visible **without signing in** —
ideally before the app is even opened — so the app reads as "app-like" immediately.

## Constraint that shapes the decision: §5 zero-JS browsing is absolute

The browsing surface (home, `/places`, `/providers`, list **detail** pages, About)
ships **zero JavaScript** by non-negotiable (§2/§5/§14). `src/lib/security.ts`
serves `script-src 'none'` there and `tests/a11y/pages.spec.ts` asserts those pages
ship **zero `<script>`**. ADR 0002 was only permissible because the confirm/report
routes are **contribute**, not browse — its guardrail #4 states the list-detail and
About pages keep the zero-JS guarantee **absolutely**.

**Consequence:** the obvious "Share this place" button **cannot** be injected as a
web script onto listing detail pages — that would break §5 and the a11y contract.
Per §2, this trade-off is decided explicitly rather than worked around: **Share, if
built, is implemented in the native shell (Swift), not as browsing-page JS.**

## Decision

Adopt a native affordance layer, chosen to respect §5 (no new script on any
browsing route). None of these add a `<script>` to a browsing page.

1. **App Shortcuts (Home-screen quick actions)** — `UIApplicationShortcutItems`
   (static, Info.plist only) for **"Find places"** and **"Find providers"**. Native,
   visible on a long-press of the app icon **before launch**, and account-free.
   Handling is native (AppDelegate tells the WKWebView to load `/places` or
   `/providers`) — the remote page's JS can't run at launch, so this is Swift, not
   web code. **Lowest cost, highest first-glance signal.**
2. **Native camera capture** (ADR 0002) — kept as the mission-tied differentiator.
3. **Spotlight indexing (CoreSpotlight)** *(optional)* — index listings so iOS
   system search surfaces "accessible" places. Native Swift in the shell; no web JS;
   a strong, distinctly-native 4.2 signal. Larger effort — pursue if (1)+(2) prove
   insufficient.
4. **Haptics on confirmation** *(optional, minor)* — `@capacitor/haptics` fired from
   the **existing** `confirm-camera.js` on the confirm/report routes (already
   script-enabled), so it opens **no new** script surface. Small polish, not a
   headline feature.

**Explicitly rejected:** a Share (or any) enhancement script on browsing/detail
pages — it violates §5 and ADR 0002's contribute-not-browse guardrail. Native-shell
Share (a WKWebView-hosted action or a native accessory) is the only §5-safe form and
is **deferred** unless a reviewer signals it's needed.

## Consequences

- The repo carries **no new browsing-page script**; the a11y zero-`<script>`
  contract is unchanged. App Shortcuts (1) and Spotlight (3) live entirely in the
  native `ios/` project, which is generated on a Mac and gitignored — so this ADR +
  [ios-native-affordances.md](ios-native-affordances.md) are the durable repo-side
  artifacts; the Swift/Info.plist changes land on the build machine.
- Haptics (4) is the only item that touches web code, and only the already-scripted
  confirm/report route — no CSP or a11y-contract change.
- A **new TestFlight/App Store build is required regardless**: builds 2–4 predate the
  camera pod and contain no native camera, so the current binaries have **no** native
  feature to demonstrate. This layer and the camera pod ship together in that build.
- Because the camera remains sign-in-gated, the App Store submission must still carry
  a **demo account** and a review-note walkthrough (see the submission checklist).
