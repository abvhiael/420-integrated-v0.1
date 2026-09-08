# 420 Wallet — W12 Release Packaging and Distribution

W12 turns the W11 native applications and qualified release boundaries into reproducible versioned release packages for Android and iOS. W12 does not weaken the W11 physical-device closeout gate and does not place signing credentials in source control.

## W12.1 — Versioned release manifest + provenance — COMPLETE
- Canonical Android/iOS release manifest established in `release-manifest.json`.
- Release version, platform version/build numbers, application/bundle identifiers, minimum OS/SDK versions, artifact names, authority-policy version, source branch and exact qualified W11 source commit are bound in one record.
- `release-manifest-check.js` validates release metadata against Android Gradle and iOS XcodeGen configuration.
- Wallet Mobile CI emits SHA-256 checksum records tied to the exact `GITHUB_SHA` for the Android APK/AAB and packaged unsigned iOS archive.
- Signing identity/certificate/keystore details remain outside committed release metadata.

## W12.2 — Android Play packaging — COMPLETE
- Canonical Play internal-testing metadata in `android/play-internal-testing.json`.
- `android-play-package-check.js` verifies package ID, version/versionCode, SDK levels, AAB identity, verified HTTPS App Link contract, notification permission, backup policy and external-only signing configuration.
- Production App Link host remains build-configured and requires Digital Asset Links.
- Play App Signing/upload key remain external authorized configuration.
- Google Play Data Safety remains explicit `REQUIRED_EXTERNAL_REVIEW`; repository checks do not falsely mark it complete.
- `W12.2-ANDROID-PLAY.md` defines the internal-test/upload procedure and external production requirements.

## W12.3 — iOS TestFlight/App Store packaging — COMPLETE
- Canonical iOS distribution metadata in `ios-appstore-package.json`.
- `ios-appstore-package-check.js` verifies bundle ID, deployment target, Associated Domains, APNs configuration, background notification mode, privacy manifest, export method and external-only signing requirements.
- `W12.3-IOS-APPSTORE.md` defines authorized TestFlight/App Store packaging and upload requirements.
- Certificates, provisioning profiles and App Store Connect credentials remain external.
- Real-iPhone device qualification remains an explicit external production-release blocker.

## W12.4 — Cross-platform release bundle — COMPLETE
- `release-bundle.json` defines one cross-platform release identity, shared authority policy, release notes, security gate, and release bill-of-materials contract.
- `release-bundle-check.js` verifies release version, qualified source commit, Android/iOS identities, SHA-256 provenance policy, authority-policy parity, BOM contents and preservation of the `device:closeout` release gate.
- `W12.4-RELEASE-BUNDLE.md` documents the bundle and its verification rules.
- `npm run release:bundle:check` is wired into the normal mobile qualification path.
- Patched and qualified the iOS metadata field-name regression; Wallet Mobile #568 and Integrated #1494 both passed.

## W12.5 — Distribution qualification — COMPLETE
- `distribution-qualification.json` defines the repository-side distribution qualification contract.
- `distribution-qualification-check.js` verifies cross-platform release identity, SHA-256 provenance policy, external-only signing, absence of committed signing/wallet secrets, and preservation of the device-closeout production gate.
- `npm run distribution:qualify` is wired into the normal mobile `check` path.
- Repository qualification is allowed to pass while production readiness remains `BLOCKED_EXTERNAL_DEVICE`.
- Production/TestFlight/Play readiness remains blocked until genuine physical Android and iPhone evidence makes `npm run device:closeout` pass.
- `W12.5-DISTRIBUTION-QUALIFICATION.md` documents the qualification boundary and external release requirements.
- Qualified on W12.5 head `befc19720b09e0198a88c25deaeb981402925491`: Wallet Mobile #578 and Integrated #1501 both passed.

## W12.6 — Release candidate closeout — IN PROGRESS
- `release-candidate-closeout.json` records the W12.5 qualified baseline, PR #113, the `main` SHA observed when closeout began, required final workflows, and the unchanged physical-device production gate.
- `release-candidate-closeout-check.js` validates release-version/authority parity, required qualification workflows, fail-closed distribution status, absence of signing fallbacks, and honest `BLOCKED_EXTERNAL_DEVICE` device evidence.
- `npm run release:candidate:check` is wired into the normal mobile qualification path.
- `W12.6-RELEASE-CANDIDATE-CLOSEOUT.md` documents the repository closeout boundary.
- PR #113 is currently mergeable into `main`; final qualification is intentionally performed on GitHub's current PR merge head so the candidate includes current `main`.
- Remaining W12.6 work: obtain green Wallet Mobile and Integrated qualification on the closeout head, then prepare PR #113 for merge. Production Play/TestFlight distribution remains blocked until genuine device closeout passes.

# W13 — Visual Design, UX Polish and Store Presentation

W13 is the dedicated public-facing design pass after the functional native wallet and release packaging foundations are complete. It does not change wallet authority, signing policy, transport policy, or canonical SmartAccount/CapabilityRegistry behavior.

## W13.1 — Design system and branded component library
- Define final typography, spacing, corner radius, elevation, iconography, color roles, dark/light behavior, and accessibility contrast targets.
- Establish shared design tokens across Android and iOS while preserving platform-native behavior.
- Replace developer-placeholder styling with production-ready branded components.

## W13.2 — Core screen visual polish
- Final visual pass for Wallet, Apps, Activity, Security, Send, Receive, Connect, approvals, recovery, passkeys, sessions, permissions, and device state.
- Normalize hierarchy, spacing, information density, action placement, empty states, loading states, warnings, and error states.
- Validate small-screen, large-screen, dynamic type, and accessibility layouts.

## W13.3 — Onboarding and first-run experience
- Create branded onboarding, wallet introduction, account discovery/creation, passkey setup, security education, backup/recovery guidance, and permission explanations.
- Ensure onboarding communicates local signing, SmartAccount authority, recovery, and privacy without misleading users about custody or device authority.

## W13.4 — Motion and micro-interactions
- Add restrained native transitions, approval-state motion, success/failure feedback, loading behavior, biometric/passkey progress, and activity-state transitions.
- Respect reduced-motion accessibility settings and avoid animation that obscures security-critical information.

## W13.5 — Graphics and visual assets
- Produce final app icon, adaptive Android icon, iOS icon set, launch/splash treatment, branded illustrations, empty-state graphics, security illustrations, and reusable vector assets.
- Ensure no visual asset contains private data, wallet addresses, keys, signatures, or misleading transaction states.

## W13.6 — Store presentation
- Produce Play Store and App Store screenshots, feature/promotional graphics, preview compositions, captions, app descriptions, privacy/security messaging, and release-facing visual assets.
- Create device-size screenshot matrices for required Android and iOS store formats.
- Keep store marketing claims aligned with qualified wallet behavior and actual release capabilities.

## W13.7 — Visual regression and accessibility qualification
- Add screenshot/reference-image regression coverage where practical.
- Run accessibility checks for contrast, dynamic text, touch target size, screen-reader labeling, focus order, and reduced motion.
- Perform final pixel-level visual QA on representative Android and iOS devices.

## W13.8 — UX/store closeout
- Reconcile visual changes against the qualified W12 release candidate.
- Run Wallet Mobile and Integrated qualification after UI changes.
- Re-run physical-device checks affected by presentation/lifecycle changes.
- Finalize store screenshot packs and presentation assets for the production candidate.

## W12 invariants
- WALLET-W12-001 — every distributed artifact is bound to an exact qualified Git commit.
- WALLET-W12-002 — artifact checksums and release metadata are reproducible and independently verifiable.
- WALLET-W12-003 — signing secrets, certificates, provisioning profiles, keystores, API keys, and wallet secrets are never committed.
- WALLET-W12-004 — packaging/distribution never becomes wallet account or signing authority.
- WALLET-W12-005 — production distribution readiness fails closed unless W11 physical-device qualification is complete.

## W13 invariants
- WALLET-W13-001 — visual changes never become account, capability, signing, or recovery authority.
- WALLET-W13-002 — security-critical states remain explicit and understandable after visual polish.
- WALLET-W13-003 — accessibility and reduced-motion behavior are first-class release requirements.
- WALLET-W13-004 — store graphics and copy describe only behavior that is actually implemented and qualified.
- WALLET-W13-005 — no screenshots, illustrations, fixtures, or marketing assets expose real secrets or private user data.
