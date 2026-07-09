# iOS / TestFlight runbook

How Access Atlas gets onto TestFlight. Decision + rationale live in
[`CLAUDE.md`](../CLAUDE.md) §13 (native / TestFlight track) and §15 (platform
membership). **Read those first.**

## The shape of it (why a wrapper)

TestFlight needs a real native binary — a PWA can't be distributed through it. So
we wrap the **existing web app** in a thin **Capacitor / WKWebView** shell rather
than rewrite the browsing surface in React Native (which §15 forbids). The wrapper
loads the **hosted site** at runtime (`capacitor.config.ts` → `server.url`),
because browsing is on-demand SSR and needs the server reachable. The bundled
`mobile/www/index.html` is only an offline fallback.

**Two gates, very different:**

| | Reviewed? | Testers | Blocker |
|---|---|---|---|
| **Internal** TestFlight | No | ≤100 (your team) | none — reachable with a bare wrapper |
| **External** TestFlight | **Beta App Review** | ≤10,000 | Guideline **4.2**: a "just a website" wrapper is rejected |

The value-add that clears **4.2** is **camera-based evidence-photo capture**
(`@capacitor/camera`) — which is downstream of building the (deferred)
evidence-photo feature (§4). So: internal TestFlight is reachable now; external
is not until photos exist.

## What's already in the repo (the scaffold)

- `capacitor.config.ts` — app id `com.beauaccess.accessatlas`, `server.url`
  placeholder, offline `webDir`. (Excluded from the Astro typecheck in
  `tsconfig.json` — it uses native `@capacitor/*` types, not web app code.)
- `mobile/www/index.html` — accessible offline fallback.

Capacitor deps are **not** pre-installed and the native `ios/` Xcode project is
**not** committed — both are created on a Mac in Phase 2 (below). This keeps the
web `package-lock.json` clean so `npm ci` and the web CI stay reproducible
without the native toolchain.

## Phase 1 — Apple portal (one-time, no code)

1. **App Store Connect → Agreements, Tax, and Banking:** accept the **Free Apps**
   agreement. (Banking is only for paid apps — not needed.)
2. **Certificates, IDs & Profiles:** register Bundle ID `com.beauaccess.accessatlas`.
   Let Xcode auto-manage the distribution cert + provisioning profile.
3. **App Store Connect → Apps → New App:** create the record (name, bundle ID,
   primary language, SKU).

## Phase 2 — Build the binary (on a Mac with Xcode + CocoaPods)

1. Set the real hosted origin in `capacitor.config.ts` → `server.url` (https).
   **This depends on the open hosting decision (§13).**
2. Install Capacitor (adds them to `package.json` + lockfile on the Mac):
   ```
   npm install @capacitor/core@^6 @capacitor/ios@^6 @capacitor/camera@^6
   npm install -D @capacitor/cli@^6
   ```
3. `npx cap add ios` — generates the native `ios/` project (needs CocoaPods).
4. `npx cap sync ios`
5. In **Xcode** (`ios/App/App.xcworkspace`):
   - Signing → your team; confirm bundle ID.
   - General → version (e.g. `0.1.0`) + build number (`1`).
   - App icon + launch screen.
   - **`Info.plist`:** `NSCameraUsageDescription` ("Add a photo as evidence for an
     accessibility claim") once camera capture lands.
   - **`PrivacyInfo.xcprivacy`** privacy manifest — declare the (minimal) data
     use. Must match §6: no disability type, no third-party tracking.
6. **Product → Archive**, then **Distribute App → App Store Connect → Upload**.

## Phase 3 — TestFlight

1. Wait for the build to finish processing in App Store Connect.
2. Answer **export compliance** (standard https crypto → usually the exemption).
3. Fill **TestFlight → Test Information** (what to test, contact email).
4. **Internal testing:** add yourself/team → install via the TestFlight app. No
   review.
5. **External testing:** add a group → submit for **Beta App Review**. Requires
   the 4.2 native value-add (camera capture) to pass.

## Access Atlas–specific blockers (track these)

- **Hosting must be live** (§13) — the wrapper loads a URL; nothing works until an
  origin is set.
- **Contribution is gated** (Keycloak not stood up) — a first build is
  **browse-only**.
- **Evidence photos don't exist yet** — the capability that justifies native /
  clears 4.2 is a deferred feature.
- **App Privacy labels** must be truthful + minimal (easy — we collect almost
  nothing).
- **Accessibility parity:** the webview inherits the web app's a11y (good); native
  chrome (permission prompts, camera UI) needs its own AT pass.

## Keeping web + native in step

The wrapper adds **zero** JavaScript to the web browsing pages — the CSP stays
`script-src 'none'` and the a11y/zero-script tests are unaffected. Capacitor lives
entirely in the native shell + `mobile/`. Don't import Capacitor into `src/`.
