import type { CapacitorConfig } from '@capacitor/cli';

// iOS TestFlight wrapper config (see docs/ios-testflight.md and CLAUDE.md §13).
//
// WHY A WRAPPER, NOT A REWRITE: TestFlight needs a real native binary, so we
// wrap the EXISTING web app in a thin Capacitor/WKWebView shell. This keeps the
// zero-JS, low-bandwidth, screen-reader-first browsing surface (§5) instead of a
// React Native rewrite, which §15 forbids for the browsing pages.
//
// The app loads the HOSTED site at runtime (`server.url`) because browsing is
// on-demand SSR and needs the server reachable. `webDir` is only a tiny offline
// fallback shown when the network/host is unavailable — the real UI is remote.
const config: CapacitorConfig = {
  appId: 'com.beauaccess.accessatlas',
  appName: 'Access Atlas',
  // Offline fallback assets only (mobile/www). NOT the app itself.
  webDir: 'mobile/www',
  server: {
    // TODO(hosting §13): set this to the real hosted origin before building for
    // TestFlight. Must be https. Until hosting is decided this is a placeholder
    // and the app will show the offline fallback.
    url: 'https://REPLACE-WITH-HOSTED-ORIGIN.example',
    // Never allow cleartext — the CSP + privacy stance demand https only (§6).
    cleartext: false,
  },
  ios: {
    // Match the web app's calm background so first paint isn't a white flash.
    backgroundColor: '#fbfbf9',
    // WKWebView content inset handled by the web layout; keep it predictable.
    contentInset: 'automatic',
  },
};

export default config;
