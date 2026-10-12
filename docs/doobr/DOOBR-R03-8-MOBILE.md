# DOOBr R03.8 — Secure iOS/Android client builds

**Canonical step:** R03.8 — Secure iOS/Android builds with platform keystore, push, foreground and narrowly scoped background GPS. **Status: PARTIAL, Level 1 run pending.** PR #601, `roadmap/doobr-bc-vancouver-infrastructure`. Inspected main `fe21ef07359d6915bf5daac37c4bf24a24fcf19b`.

## Repository-side implementation
- `doobr/mobile_security.py`: server-side validation model requiring hardware-backed device keys with independent attestation, unlocked device and valid scoped courier tracking permission/assignment/navigation; background tracking can be enabled only if all foreground gates remain true and background permission is independently present. Push payloads accept only allowlisted opaque routing values; service activation remains false.
- `mobile/doobr/android`: Gradle/Android Kotlin scaffold, AndroidKeyStore signing-key creation gated by device authentication, encrypted transport enforced and backups off. Android build includes foreground location permission declarations only; there is no background service or silently active tracker.
- `mobile/doobr/ios`: SwiftUI and Secure Enclave key generation draft, when-in-use usage disclosure; no background capability enabled, no active location observer or app push registration.
- `doobr/storage/tests/test_mobile_security.py`: adversarial permission, expiry, assignment, push PII denial, and no-live-operation checks.
- `.github/workflows/doobr-r03-8-level1.yml`: exact-SHA contract tests, Android debug build and platform manifests.

## Outstanding original requirements
- iOS is **not** yet a buildable Xcode project (no generated project/target/signing configuration). Mac simulator, app attestation and physical Secure Enclave behavior remain unqualified.
- Android native key attestation, lifecycle permission prompts, scoped GPS foreground capture, narrow background behavior, push registration/handling and server token revocation are not integrated end-to-end. No real device acceptance.
- Push transport must integrate 420Notifications and APNs/FCM with actual configured and independently authorized credentials, encrypted redacted payloads, replay expiration and revocation. No secret can be committed or pushed to the static web frontend.
- Complete native mobile integration, app lifecycle and hardware testing remain outstanding. Only truly live hardware/provider acceptance should move to the canonical testnet/deferred roadmap; missing local code does not qualify for deferral.
- No app store builds, actual dispatch/delivery capability, operational GPS processing or externally authorized cannabis handling has been approved.

**Level 2:** R03.12 clients/travel. **Level 3:** R05.10 exact reconciled phase SHA.

**Next canonical roadmap step:** R03.9 — Offline queue/reconnect, token/device revocation and location permission failure.

## R03.8 native implementation follow-up
- `mobile/doobr/ios/DOOBr.xcodeproj/project.pbxproj` adds an iOS simulator application target with signing deliberately disabled in CI. `DOOBrApp.swift` now requests OS when-in-use location and notification consent explicitly, stops location when revoked and when no verified assignment is present, and adds a device-only, user-presence protected Secure Enclave key. No precise coordinates are transmitted. This is not hardware attestation acceptance.
- Android `MainActivity.kt` now has OS foreground location and notification permission prompts, denial handling, and onStop tracking shutdown. Assignment and courier consent cannot be self-elevated from the UI, and background location remains absent.
- `.github/workflows/doobr-r03-8-level1.yml` now requires a real unsigned iOS simulator build on macOS as well as the Android debug build on Linux. An untriggered or failed iOS job does not count as PASS.
- Remaining external acceptance is retained in the canonical testnet/deferred roadmap: physical device attestation, APNs/FCM delivery, external assignment proof, revocation, narrowly scoped background GPS, native device testing and app store signing. Native push receipt/registration and actual assigned-route tracking are intentionally disabled, not represented as qualified.

## Acceptance transfer verification (2026-10-11)
Physical-device attestation, GPS on-device behavior, real APNs/FCM through 420Notifications, and app-store production signing are tracked explicitly as **NOT COMPLETE** in `docs/audit/DOOBR-TESTNET-DEFERRED-QUALIFICATION-ROADMAP.md`, under the R03.8 acceptance classification. Physical devices, provider and signing accounts are external requirements; none automatically depends on a live blockchain testnet. If the canonical deployment/notification/assignment authority relies on the testnet, qualify that live integration at the testnet gate. Existing iOS simulator and Android debug Level 1 PASS at `7e56690ccb50c3aab6583845c075499ae2897b0d`, workflow #38187207249, does not prove real-device or signed-release acceptance. Local implementation gaps remain work to do and are NOT reclassified as testnet prerequisites.

## Native push, release and route lifecycle hardening
- `doobr/mobile_push.py` provides authenticated device-specific registration eligibility and time-bounded, opaque-only push verification. Revoked authentication, missing hardware attestation and stale/PII push are denied. No APNs/FCM tokens are persisted and no service registration is attempted before independent authority is connected.
- iOS location manager stops upon OS permission loss, route expiration and manual termination; its assignment authorization remains inaccessible to UI input. Android route-eligibility now checks explicit foreground permission, assignment, consent and monotonic expiry deadline; both stop on lifecycle exit. Neither platform transmits actual coordinates pending canonical encrypted tracking service authority.
- Android release configuration explicitly has no signing key in source, enables shrink/optimization, and CI attempts a release artifact alongside debug. iOS remains unsigned simulator-qualified; production signing remains an external acceptance gate.
- Testnet/external requirements: real APNs/FCM and 420Notifications transport, device attestation, actual enrolled-courier route grants, physical OS background GPS acceptance and production signing. These remain NOT COMPLETE and are recorded in `docs/audit/DOOBR-TESTNET-DEFERRED-QUALIFICATION-ROADMAP.md`. Real native push receiver/provider callbacks and actual encrypted GPS route capture are not yet operational. R03.9 will address reconnect and revocation lifecycle, without treating unimplemented code as a qualified live function.
