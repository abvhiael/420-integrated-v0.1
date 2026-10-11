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
