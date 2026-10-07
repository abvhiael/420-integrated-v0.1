# PB-12 — Mobile applications

## Purpose
Implement repository-side native PuffBuddies clients for **iOS and Android** after the qualified PB-11 web MVP, while preserving PuffBuddies server/domain authority and all PB-0 privacy, consent, safety, lifecycle, deletion and non-goal invariants.

PB-12 promotes the native iOS/Android clients that PB-0.2 explicitly deferred from the initial web-first MVP. It does not claim store distribution, signed device builds, production push credentials, live API binding or release readiness.

## Canonical implementation area
PB-12 authorizes `puffbuddies/mobile/` under PB-STRUCT-017.

The area contains:
- shared mobile state/API/platform/screen/app-shell logic;
- iOS native project/source;
- Android native project/source;
- repository mobile qualification tests and static/build checks.

Dependency direction remains:
`mobile -> authenticated PuffBuddies API -> canonical PuffBuddies domain`.

The mobile clients never become canonical relationship, consent, eligibility, visibility, lifecycle, deletion or safety authority.

## Native client scope
Both platforms must expose the same product surfaces already qualified by PB-11:
- eligibility/status entry;
- profile editing;
- profile media handoff;
- discovery;
- like/pass;
- current matches;
- matched messaging entry;
- notifications;
- block/report/unmatch;
- visibility/lifecycle/deletion controls;
- PB-9 verification presentation;
- PB-10 premium feature availability.

The mobile layer adds only bounded device capabilities:
- device-bound secure session storage;
- app lifecycle resume/revalidation;
- camera/photo media handoff;
- OS notification registration handoff;
- verified HTTPS app/universal links.

## Canonical requirements
1. Repository contains both iOS and Android PuffBuddies native project/source trees.
2. Both native clients expose the complete PB-11-equivalent core surface.
3. Shared mobile state is presentation/cache only.
4. Current PuffBuddies API/domain remains the sole application authorization source.
5. Mobile API endpoints are injected and must be HTTPS; no hard-coded live endpoint is committed.
6. Repository runtime config explicitly remains `repository-qualified-not-deployed`.
7. Derived discovery/match/notification/premium caches are memory-only.
8. Authority-generation increase clears derived state.
9. Lower/stale authority generation fails closed.
10. App resume clears derived state before current-session/server revalidation.
11. Protected 401/403/409/410 responses clear derived client state.
12. Sign-out clears secure session and all derived presentation state.
13. iOS session token storage uses device-bound Keychain accessibility.
14. Android session token storage uses AndroidKeyStore-backed AES-GCM with unlocked-device requirement.
15. Session token is bounded and never stored as source/runtime config.
16. No wallet private key, remote signer or blockchain signing authority is introduced.
17. Profile media handoff accepts only bounded JPEG/PNG/WebP and opaque device-media references.
18. Mobile source does not request precise/fine location permission.
19. Android disables cleartext traffic.
20. API client accepts HTTPS only.
21. Verified app/universal-link configuration is present; unsupported/custom insecure routes are rejected by shared policy.
22. Deep links cannot manufacture match, unblock, admin consent or other application authority.
23. Push registration uses an opaque device reference; raw provider credentials/tokens are not committed.
24. Push/notification state remains 420Notifications-owned/non-authoritative.
25. Block/report/unmatch/deactivation/deletion remain baseline and cannot be premium-gated.
26. Premium remains feature availability only and cannot create consent, match, message, unblock, safety exception or protected-data access.
27. Verification indicators remain presentation only.
28. No exact address/GPS, wallet-profile enumeration, public match graph, public safety/reputation graph or raw moderation evidence is introduced.
29. No client action named FORCE_MATCH/FORCE_UNBLOCK/ADMIN_MATCH/BLOCK_OVERRIDE/UNSUSPEND/UNBAN is permitted.
30. iOS/Android bundle/application identifiers are stable and valid.
31. Repository build emits only a reproducible non-canonical source/bundle manifest.
32. Generated mobile build artifacts are not committed as canonical state.
33. No Apple signing certificate/profile, Android keystore/signing secret, APNs/FCM credential, production API secret or store credential is committed.
34. PB-12 does not claim Xcode/Android SDK device build success on unavailable external toolchains.
35. PB-12 does not claim App Store/Play Store submission, review or distribution.
36. PB-14 remains backend/API-hardening owner.
37. PB-17+ remain live environment/device/release qualification owners.

## Qualification
PB-12 requires:
- **Level 1** exact-head mobile qualification: shared JavaScript syntax/static checks, behavioral tests, repository mobile bundle build, native-source/security/project checks and privacy/static gates.
- **Level 2** **PB-11/PB-12 client-parity milestone**, because PB-12 adds two user-facing clients over the accumulated PB-1 through PB-11 application authority.

The Level-2 milestone must run:
- the PB-12 mobile retained tests;
- the retained PB-11 web qualification;
- the complete retained PuffBuddies Python suite;
- the PB-0 structure/authority verifier.

Level 2 remains app-focused. Full Solidity, Genesis, global/Geth/fault/soak and deployment qualification remain Level 3/later release work.

## Affected components
- `puffbuddies/mobile/package.json`
- `puffbuddies/mobile/runtime-config.json`
- `puffbuddies/mobile/core/*`
- `puffbuddies/mobile/ios/*`
- `puffbuddies/mobile/android/*`
- `puffbuddies/mobile/scripts/*`
- `puffbuddies/mobile/test/*`
- PB-0.17 structural authorization
- PB-12 workflow
- current roadmap/master mapping
- durable qualification evidence

## Dependencies
PB-0.2, PB-0.3, PB-0.4, PB-0.5, PB-0.7, PB-0.8, PB-0.9, PB-0.10, PB-0.11, PB-0.12, PB-0.13, PB-0.14, PB-0.15, PB-0.16, PB-0.17; PB-1 through **PB-11 — Web application — COMPLETE**.

## Exit criteria
- iOS and Android source trees exist and pass mobile project/security checks;
- shared mobile core passes exact-head behavioral/static qualification;
- device-bound session storage boundaries are verified;
- stale-state/revocation/resume rules pass;
- no precise-location, signing-authority, raw push-credential or client-authority leak exists;
- repository mobile bundle build passes;
- retained PB-11 web qualification passes on the same SHA;
- complete retained PuffBuddies regression suite passes;
- PB-0 structure/authority owner remains green;
- exact implementation SHA is durably recorded;
- device/store/live API/push/distribution gates remain explicitly deferred rather than falsely claimed.
