# iOS native affordances — build-machine runbook

The Mac/Xcode steps that implement [ADR 0003](adr-0003-ios-native-affordances.md):
the small layer of **native** behaviour that strengthens the App Review **4.2**
(minimum functionality) case beyond the sign-in-gated camera. Read ADR 0003 and
[ios-testflight.md](ios-testflight.md) first.

Everything here lives in the native `ios/` project, which is generated on a Mac
(`npx cap add ios`) and **gitignored** — none of it is committable web-repo code, so
this doc is the source of truth for it.

> **This project is Swift Package Manager–based, not CocoaPods** (Capacitor 8 — there
> is `ios/App/CapApp-SPM/Package.swift` and no `Podfile`). So: no `pod install`, no
> CocoaPods UTF-8 quirk, and you open **`ios/App/App.xcodeproj`** (there is no
> `.xcworkspace`). `npx cap sync ios` wires plugins into `CapApp-SPM/Package.swift`
> automatically. Set `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.

## 0. Prerequisites (once)

The `ios/` project already exists on the build Mac, so **do not** run `npx cap add ios`
(that would regenerate it). Just add the plugins and sync:

```
# from the repo root, on the Mac. Versions matched to Capacitor core 8.4.2:
npm install @capacitor/camera@^8 @capacitor/haptics@^8   # resolves camera 8.2.2 / haptics 8.0.2
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npx cap sync ios
```

`npm install` updates `package.json` + `package-lock.json` — commit them; they are
real native-build deps and the web build never imports them (the confirm script uses
the global bridge), so web CI is unaffected. Confirm with `npm run check` +
`npm run test:unit`. `@capacitor/share` is only needed if native-shell Share is
pursued later (ADR 0003 defers it); it is **not** required for the layer below.

## 1. App Shortcuts — Home-screen quick actions (ADR 0003 item 1)

Static shortcuts need no plugin — they are Info.plist + a native handler.

### 1a. `ios/App/App/Info.plist` — declare the items

```xml
<key>UIApplicationShortcutItems</key>
<array>
  <dict>
    <key>UIApplicationShortcutItemType</key>
    <string>com.beauaccess.accessatlas.places</string>
    <key>UIApplicationShortcutItemTitle</key>
    <string>Find places</string>
    <key>UIApplicationShortcutItemIconType</key>
    <string>UIApplicationShortcutIconTypeLocation</string>
  </dict>
  <dict>
    <key>UIApplicationShortcutItemType</key>
    <string>com.beauaccess.accessatlas.providers</string>
    <key>UIApplicationShortcutItemTitle</key>
    <string>Find providers</string>
    <key>UIApplicationShortcutItemIconType</key>
    <string>UIApplicationShortcutIconTypeContact</string>
  </dict>
</array>
```

### 1b. Handle the tap — load the right route in the WKWebView

The app loads a **remote** `server.url`, so the web page's JS is not available at
launch to route the shortcut. Handle it natively and point the bridge's web view at
the path. In `ios/App/App/AppDelegate.swift`:

```swift
import Capacitor

func application(_ application: UIApplication,
                performActionFor shortcutItem: UIApplicationShortcutItem,
                completionHandler: @escaping (Bool) -> Void) {
    let base = "https://access-atlas-qd464.ondigitalocean.app"
    let path: String
    switch shortcutItem.type {
    case "com.beauaccess.accessatlas.places":    path = "/places"
    case "com.beauaccess.accessatlas.providers": path = "/providers"
    default:                                     path = "/"
    }
    if let vc = window?.rootViewController as? CAPBridgeViewController,
       let url = URL(string: base + path) {
        vc.webView?.load(URLRequest(url: url))
    }
    completionHandler(true)
}
```

> Keep the base URL in sync with `capacitor.config.ts` → `server.url`. If a custom
> domain is added later, update both.

**Verify on device:** long-press the app icon → both actions appear → each opens the
app straight to the right list. VoiceOver: the actions are announced by their titles.

## 2. Native camera (ADR 0002) — Info.plist usage strings

`public/confirm-camera.js` already ships from the web app and calls
`window.Capacitor.Plugins.Camera` via the global bridge. The plugin (step 0) plus these
usage strings are all the native side needs:

```xml
<key>NSCameraUsageDescription</key>
<string>Add a photo as evidence for an accessibility claim.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Attach a saved photo as evidence for an accessibility claim.</string>
```

**Biggest unknown to de-risk here (ADR 0002):** confirm the plugin is reachable via
the global bridge **without bundling** the npm wrapper — open a confirm/report form
in the app and check the **"Take a photo with the camera"** button appears and
captures. If it does **not**, the fallback is a one-file Astro client entry importing
`@capacitor/camera` (still one self-hosted script; see the camera scope doc).

**Also verify:** the confirm/report routes serve `Permissions-Policy: camera=()`
(from `src/lib/security.ts`). The **native** plugin uses `UIImagePickerController`
and bypasses the web camera API, so this should not block it — but confirm capture
works on device. If it ever does interfere, the scoped fix is to grant
`camera=(self)` on the two script-enhanced contribute prefixes, mirroring how
`geolocation=(self)` is already handled there.

## 3. Haptics (ADR 0003 item 4, optional)

A light haptic on a successful capture, fired from the **existing**
`public/confirm-camera.js` (already the one allowed script on that route — no new
script surface). After the photo is attached:

```js
// inside confirm-camera.js, after attachToInput(...) succeeds
if (cap.Plugins && cap.Plugins.Haptics) {
  cap.Plugins.Haptics.impact({ style: 'LIGHT' }).catch(function () {});
}
```

Native-gated already (the whole file no-ops unless `isNativePlatform()`), so it adds
nothing on web. Requires `@capacitor/haptics` (step 0). Purely additive polish.

## 4. Spotlight indexing (ADR 0003 item 3, optional / larger)

If (1)+(2) prove an insufficient 4.2 case, index listings with **CoreSpotlight** so
iOS system search finds accessible places. This is native Swift in the shell (a
`CSSearchableItem` per listing, fetched from the public listing data), opening the
app to the listing on selection. No web JS. Scope it as its own task if pursued —
it is the strongest distinctly-native signal but the most work.

## Build & submit

After the above, follow [ios-testflight.md](ios-testflight.md) Phase 2–3 to archive
and upload a **new** build (mandatory — current builds 2–4 have no camera plugin), then
the App Store submission checklist. Because the camera is sign-in-gated, include a
**demo Keycloak account** and a review-note walkthrough in App Review Information.
