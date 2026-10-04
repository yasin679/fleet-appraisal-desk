# Fleet Appraisal Desk — Mobile

The same screens, rules and comparison maths as the web module, packaged as a phone app that works **fully offline** with the demo fleet. Data entered on the phone is kept on the phone (local storage) and survives restarts; **Demo data → Reset** (as `CREWING`) starts again.

| | Android | iPhone / iPad |
| --- | --- | --- |
| Package | `FleetAppraisalDesk-2.1.0.apk` | Xcode project (Capacitor) · unsigned `.ipa` from CI · installable web app |
| App ID | `com.yasinjariwala.fleetappraisal` | `com.yasinjariwala.fleetappraisal` |
| Version | 2.1.0 (210) | 2.1.0 (210) |
| Minimum OS | Android 7.0 (API 24) | iOS 14 |

Sign in with any demo account (password `demo`), e.g. `V1-2O`, `V1-CO`, `V1-MST`, `CREWING`.

## Layout

```
mobile/
  www/                 built web bundle (web/build.sh) + manifest, service worker, icons
  android/             native WebView shell, no Gradle needed
    build-apk.sh       aapt2 → javac/ecj → d8 → zipalign → apksigner
  ios/App/             Xcode project (Capacitor 7, Swift Package Manager)
  capacitor.config.json
  package.json
```

## Android

**Install:** copy the APK to the phone, open it, and allow *Install unknown apps* for the file manager or browser when asked.

**Build** (needs JDK 17+ and the Android SDK: build-tools and `platforms;android-34`):

```bash
bash web/build.sh
cd mobile/android && bash build-apk.sh          # → dist/FleetAppraisalDesk-2.1.0.apk
```

Without `KEYSTORE` the script creates a local key in `android/keystore/` (ignored by git). For a release, keep one key for the life of the app and pass it in:

```bash
KEYSTORE=/path/release.jks KEYSTORE_PASS=... KEY_ALIAS=... bash build-apk.sh
```

## iOS

An iPhone app must be built on a Mac and signed with an Apple ID. Three ways to get it on a phone:

1. **Xcode (Mac):**
   ```bash
   bash web/build.sh
   cd mobile && npm install && npx cap sync ios && npx cap open ios
   ```
   Choose your team under *Signing & Capabilities*, plug in the iPhone and press Run. A free Apple ID works for your own device (re-sign every 7 days); TestFlight or the App Store needs the Apple Developer Program.
2. **GitHub Actions (no Mac):** the *Mobile* workflow builds `FleetAppraisalDesk-unsigned.ipa` and a simulator build on a macOS runner. Download the artifact and install the `.ipa` with Sideloadly or AltStore, which sign it with your Apple ID.
3. **Installable web app (any iPhone, no Apple account):** the same workflow publishes `mobile/www` to GitHub Pages (enable *Settings → Pages → Source: GitHub Actions*). Open the page in Safari → Share → *Add to Home Screen*. It opens full-screen and works offline after the first visit.

## CI secrets (optional)

| Secret | Use |
| --- | --- |
| `ANDROID_KEYSTORE_B64` | base64 of the release `.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |

Without them the Android job signs with a throw-away key, which is fine for testing but cannot update an app signed with another key.

## Scope

Offline demo only: the app does not talk to the server. Connecting it to the deployed API (sign-in, sync, offline drafts with the expected-step check) is planned for the pilot release.
