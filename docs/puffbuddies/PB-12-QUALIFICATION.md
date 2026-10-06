# PB-12 qualification evidence

## Step
**PB-12 — Mobile applications — COMPLETE**

## Qualification
- **Level 1 — PB-12 mobile applications qualification — COMPLETE**
- **Level 2 — PB-11/PB-12 client-parity integration milestone — COMPLETE**

## Qualified implementation SHA
`27b793be6a5391408881eeff7b412843d6fa3858`

## Repository relationship
- branch: `puffbuddies-pb12-mobile-applications-20261006`
- PR: #549
- stacked PR base branch: `puffbuddies-pb11-web-application-20261006`
- stacked PR base SHA: `6431dd1e173361e334b4610dd138726b62705da3`
- current repository `main`: `9bf48f473489a2ad9d0a70f45675c644745ddde8`
- PB-11 remains open/qualified and was intentionally not merged without explicit merge instruction
- PR #549 was mergeable at qualification inspection

## Canonical scope
PB-12 promotes the native iOS and Android clients explicitly deferred by PB-0.2 behind the web-first MVP.

PB-12 adds a new `puffbuddies/mobile/` area under PB-STRUCT-017 with explicit owner, purpose, authority/data boundaries, dependency direction, privacy/revocation behavior, deployment implications and qualification ownership.

The mobile clients remain presentation/runtime consumers:
`mobile -> authenticated PuffBuddies API -> canonical PuffBuddies domain`.

They do not become canonical relationship, consent, eligibility, lifecycle, deletion, visibility or safety authority.

## Implemented mobile surfaces
Shared mobile core plus both native project/source trees cover:
- eligibility/status entry;
- profile/editing;
- bounded profile-media handoff;
- discovery;
- like/pass;
- current matches;
- matched Messenger entry;
- notifications;
- block/report/unmatch;
- visibility/lifecycle/deletion controls;
- PB-9 verification presentation;
- PB-10 premium feature availability.

## Native/device boundaries implemented
- iOS project/source tree;
- Android project/source tree;
- iOS device-bound Keychain session store;
- Android AndroidKeyStore AES-GCM session store;
- unlocked-device requirement on Android key material;
- app lifecycle resume invalidation/revalidation;
- injected HTTPS-only API configuration;
- verified HTTPS app/universal-link configuration;
- bounded JPEG/PNG/WebP device-media handoff;
- opaque push-device registration handoff;
- no precise/fine-location permission;
- Android cleartext traffic disabled;
- stable iOS/Android bundle/application IDs;
- no live API/provider/store credential embedded in source.

## Files changed
- `puffbuddies/mobile/package.json`
- `puffbuddies/mobile/runtime-config.json`
- `puffbuddies/mobile/core/state.js`
- `puffbuddies/mobile/core/api-client.js`
- `puffbuddies/mobile/core/platform-adapters.js`
- `puffbuddies/mobile/core/screen-model.js`
- `puffbuddies/mobile/core/app-shell.js`
- `puffbuddies/mobile/ios/project.yml`
- `puffbuddies/mobile/ios/PuffBuddies/*`
- `puffbuddies/mobile/android/settings.gradle.kts`
- `puffbuddies/mobile/android/build.gradle.kts`
- `puffbuddies/mobile/android/app/build.gradle.kts`
- `puffbuddies/mobile/android/app/src/main/AndroidManifest.xml`
- `puffbuddies/mobile/android/app/src/main/java/org/fourtwenty/puffbuddies/*`
- `puffbuddies/mobile/scripts/check.mjs`
- `puffbuddies/mobile/scripts/build.mjs`
- `puffbuddies/mobile/test/mobile.test.js`
- `docs/puffbuddies/PB-12-MOBILE-APPLICATIONS.md`
- `docs/puffbuddies/PB-0.17-REPOSITORY-STRUCTURE.md`
- `docs/puffbuddies/PB-0.19-MASTER-IMPLEMENTATION-ROADMAP.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `.github/workflows/puffbuddies-pb12.yml`

## Requirements satisfied
1. iOS native project/source tree exists.
2. Android native project/source tree exists.
3. Both clients expose the PB-11-equivalent core surface.
4. Shared mobile state is presentation/cache only.
5. API endpoints are injected HTTPS-only.
6. No hard-coded live API endpoint is committed.
7. Runtime config explicitly remains repository-qualified-not-deployed.
8. Derived cache is memory-only.
9. Authority-generation increase clears derived state.
10. Stale/lower authority generation fails closed.
11. Resume clears derived state before revalidation.
12. Protected 401/403/409/410 denial clears derived state.
13. Sign-out clears secure session plus derived state.
14. iOS uses device-bound Keychain accessibility.
15. Android uses AndroidKeyStore AES-GCM.
16. Android keys require unlocked device.
17. No wallet private key/remote signer/blockchain signing authority is introduced.
18. Media handoff accepts only JPEG/PNG/WebP.
19. Media input is opaque device reference, not persisted file-system identity.
20. No precise/fine-location permission exists.
21. Android cleartext traffic is disabled.
22. Verified HTTPS app-link/universal-link configuration exists.
23. Shared app-link policy rejects insecure/unsupported routes.
24. Push registration uses opaque device reference.
25. No raw APNs/FCM credential/config is committed.
26. Notifications remain non-authoritative.
27. Block/report/unmatch/deactivate/delete remain baseline non-premium actions.
28. Premium cannot manufacture consent/match/message/unblock/safety authority.
29. Verification remains presentation-only.
30. No client FORCE_MATCH/FORCE_UNBLOCK/ADMIN_MATCH/BLOCK_OVERRIDE/UNSUSPEND/UNBAN path exists.
31. No precise address/GPS, public match graph, public safety/reputation graph or wallet-profile enumeration is introduced.
32. iOS/Android application identifiers are stable and valid.
33. Repository mobile build emits only a non-canonical source/bundle manifest.
34. No signing keystore/certificate/profile, APK/AAB/IPA, Google service config or Apple service config is committed.
35. PB-14 remains backend/API-hardening owner.
36. PB-17+ remain live device/environment/release qualification owners.

## Exact-SHA qualification

### PuffBuddies PB-12 Qualification
- workflow: **PuffBuddies PB-12 Qualification**
- run: `37537334467` — **SUCCESS**
- run number: `2`
- job: `112521562558` (`pb12-mobile`) — **SUCCESS**
- exact-head verification — PASS
- Node 22 setup — PASS
- **PB-12 Level 1 mobile static checks** — PASS
- **PB-12 Level 1 mobile tests** — PASS
- **PB-12 Level 1 repository mobile bundle build** — PASS
- **PB-12 Level 2 retained PB-11 web qualification** — PASS
- **PB-12 Level 2 retained PuffBuddies integration** — PASS
- PB-0 structure/authority verifier — PASS
- mobile privacy/authority/secret negative gate — PASS

### Directly affected PB-0 owner
PB-12 creates a new app-scoped implementation area under PB-STRUCT-017 and updates PB-0.17/PB-0.19 structure/scope authority.
- workflow: **PuffBuddies PB-0 Qualification**
- run: `37537334442` — **SUCCESS**
- run number: `366`
- job: `112521563020` (`pb0-fast`) — **SUCCESS**

## Level-2 client-parity result
The exact qualified SHA re-ran the complete PB-11 web qualification and the full retained PuffBuddies Python inventory.

This proves:
1. native-client additions did not weaken the qualified PB-11 web boundary;
2. PB-1 through PB-10 domain authorization remains unchanged;
3. block/safety/lifecycle/eligibility supremacy remains intact;
4. mobile cannot manufacture relationship or messaging authority;
5. premium/verification remain subordinate;
6. the three user-facing client surfaces—web, iOS source, Android source—share the same server-revalidated authority model.

## Security/adversarial/invariant results
PASS for:
- stale authority generation;
- resume-derived-cache invalidation;
- protected API denial state purge;
- no-network operation when API is unconfigured;
- insecure HTTP API rejection;
- unsupported/custom app-link rejection;
- unsupported media type / oversized media rejection;
- raw media path rejection in favor of opaque reference;
- raw push-provider token form rejection;
- force-match/unblock/admin/block-override client-action rejection;
- iOS device-bound Keychain requirement;
- Android AndroidKeyStore AES-GCM requirement;
- no precise-location permission;
- no Android cleartext;
- no signing/private-key authority;
- no committed signing/store/provider secret or packaged binary artifact.

## Repository build result
PB-12 produces a deterministic repository bundle manifest from the shared mobile core and native iOS/Android source trees.

The generated `dist/` output is explicitly non-canonical and not committed.

## Native build/device qualification boundary
PB-12 does **not** claim unavailable external/device evidence:
- Xcode signed archive;
- Android signed APK/AAB;
- physical iPhone/iPad device execution;
- physical Android device execution;
- Apple provisioning/signing;
- Android Play signing;
- APNs/FCM live-provider credentials;
- App Store review/submission;
- Play Store review/submission.

Those are live/device/distribution gates for later release/testnet phases, not fabricated repository evidence.

## Repository-wide Docs workflow
The broad 420Docs workflow auto-triggered from documentation changes. It is not required for PB-12 Level-1/Level-2 completion under the phase policy and is not counted as PASS unless it completes successfully.

## Milestone status
**PB-11/PB-12 client-parity integration milestone COMPLETE at Level 2.**

## Intentionally deferred Level 3
Deferred to complete app-phase closeout:
- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- Geth/fault/soak;
- final deployment/config verification;
- final current-main reconciliation.

PB-12 introduces no contract/address/deployment state requiring those inventories now.

## Limitations / later owners
- **PB-13 — 420Integrated cross-app integration** owns broader ecosystem convergence.
- **PB-14 — Backend/API hardening** owns production API/transport hardening.
- **PB-17 — Closed testnet** owns live closed-environment/device integration qualification.
- PB-18/PB-19/PB-20 own later public-testnet/mainnet/launch readiness.

## Blockers
**None for repository PB-12 qualification.**

Live API, signed device builds, provider credentials and app-store distribution are intentional later-phase external gates, not PB-12 repository-completion blockers.

## Completion state
**PB-12 COMPLETE** against exact implementation SHA `27b793be6a5391408881eeff7b412843d6fa3858`.

## Evidence inheritance
This qualification document and roadmap COMPLETE marker are evidence-only bookkeeping after the exact implementation SHA passed every required PB-12 Level-1/Level-2 and directly affected PB-0 check. They change no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements and therefore do not require recursive qualification.

## Next canonical roadmap step
**PB-13 — 420Integrated cross-app integration**
