# LIFTd MBL-1 — Level 1 exact-SHA qualification certificate

**Disposition:** PASS — repository-scoped MBL-1 implementation and native debug/simulator compilation.
**Qualification level:** Level 1 only. M-MBL-A Level 2 and MBL phase Level 3 are not started.
**Tested implementation SHA:** `bbf681a4d9a07907ee01080664ab4a2be12ca328`
**Reconciliation baseline:** main `131fc7abd814febb9edd5caeb2d0f973350a5418` at MBL-1 discovery; PR opened against then-current main `495b6506243a494f6076c69fb9c752874e1e137a`. Validate main drift again before merge.
**Branch:** `feat/liftd-mbl1-native-foundation-20261019`
**PR:** https://github.com/abvhiael/420-integrated-v0.1/pull/756
**Canonical MBL workstream proposal:** PR #754; no L01–L03 renumbering.

## Qualified scope

* `rideshare/mobile/`: Expo/React Native TypeScript shared shell, Android package and iOS bundle IDs in a nonproduction `.preview` namespace, themes, keyboard/screen-reader accessible button labels, rider/driver selection and return.
* Role-sensitive preview policy: missing/invalid/opposing roles are denied entry; no operator screen, live account, trip, driver-eligibility or booking authority is fabricated.
* Native configuration: no platform permission requests, no insecure Android cleartext traffic, no OTA updates, no server URLs, network, payment, dispatch or production endpoint usage in the preview shell.
* Scoped workflow `.github/workflows/liftd-mobile-mbl1-level1.yml` owns Node 22 contracts, Android nonproduction debug packaging and iOS simulator compilation.

## Verified GitHub Actions evidence

One complete successful workflow, all tests/builds against the exact implementation SHA:

* Run: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39208359850
* `mobile-contracts`: **PASS**, job `117916026653` — scoped dependencies, `npm run check` (TypeScript/noEmit and Node unit/security/config tests).
* `android-debug`: **PASS**, job `117916203179` — Android Gradle `:app:assembleDebug`, nonproduction APK plus source SHA and artifact checksum uploaded.
* `ios-simulator`: **PASS**, job `117916203204` — iOS Expo prebuild, CocoaPods and unsigned Xcode simulator Debug compilation.
* Artifact: `liftd-mbl1-android-bbf681a4d9a07907ee01080664ab4a2be12ca328` (GitHub Actions artifact ID `12167090933`, 38,960,128 bytes at verification). APK is a nonproduction debug artifact, not a Play-signed release.
* An earlier candidate `5dda5c64f13aec983daf67dec7f223645a334880` failed Android runner setup because a legacy action attempted to install removed SDK package `tools`; replaced with installed Android SDK verification, then qualified the corrected exact SHA above. Prior failed run is not represented as PASS.

## Retained external gates and exclusions

No physical iOS/Android device tests, release signing, internal store distribution, live Identity, official testnet backend, Location/Wallet/Pay, driver authorization, transport compliance, privacy/accessibility independent review or public traffic permission is accepted by these builds. These remain TN-MBL-1–4, LT-01–08 and the existing canonical LIFTd testnet/production registers. No production server, migrations, existing LIFTd web, global Foundry, Genesis, Integrated or Docs qualification changed; do not rerun unrelated inventories for this certificate.

**Next MBL step:** MBL-2 — verified Identity/session integration, secure credential storage, revocation and role/session lifecycle. MBL-1 must not be represented as a live ride app.
