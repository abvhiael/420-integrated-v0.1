# 420 Wallet — W12 Release Packaging and Distribution

W12 turns the W11 native applications and qualified release boundaries into reproducible versioned release packages for Android and iOS. W12 does not weaken the W11 physical-device closeout gate and does not place signing credentials in source control.

## W12.1 — Versioned release manifest + provenance — COMPLETE
- Canonical Android/iOS release manifest established in `release-manifest.json`.
- Release version, platform version/build numbers, application/bundle identifiers, minimum OS/SDK versions, artifact names, authority-policy version, source branch and exact qualified W11 source commit are bound in one record.
- `release-manifest-check.js` validates release metadata against Android Gradle and iOS XcodeGen configuration.
- Wallet Mobile CI now emits SHA-256 checksum records tied to the exact `GITHUB_SHA` for the Android APK/AAB and packaged unsigned iOS archive.
- Signing identity/certificate/keystore details remain outside committed release metadata.

## W12.2 — Android Play packaging — COMPLETE
- Canonical Play internal-testing metadata added in `android/play-internal-testing.json`.
- `android-play-package-check.js` verifies package ID, version/versionCode, SDK levels, AAB identity, verified HTTPS App Link contract, notification permission, backup policy and external-only signing configuration.
- Production App Link host remains build-configured and requires Digital Asset Links.
- Play App Signing/upload key remain external authorized configuration.
- Google Play Data Safety is explicitly `REQUIRED_EXTERNAL_REVIEW`; no repository test falsely marks it complete.
- `W12.2-ANDROID-PLAY.md` defines the internal-test/upload procedure and external production requirements.
- Wallet Mobile Verification #546 and Integrated Qualification #1480 passed on the W12.2 head.

## W12.3 — iOS TestFlight/App Store packaging — IN PROGRESS
- Canonical App Store package metadata added in `ios-appstore-package.json`.
- `ios-appstore-package-check.js` verifies bundle ID, deployment target, Associated Domains configuration, APNs configuration, background notification mode, privacy manifest, export method, external-only signing policy and the real-iPhone release blocker.
- `W12.3-IOS-APPSTORE.md` defines authorized archive/export/TestFlight procedure and required external evidence.
- Certificates, provisioning profiles, App Store Connect API keys and signing credentials remain external to source control.
- Real-iPhone qualification remains `BLOCKED_EXTERNAL_DEVICE` and mandatory before production App Store readiness.
- Remaining W12.3 work: qualify the current branch in CI and inspect the resulting native/release artifact lane before closing the repo-side package contract.

## W12.4 — Cross-platform release bundle
- Create release-note/change-summary metadata tied to the same source SHA.
- Generate artifact checksum manifest and release bill of materials.
- Require identical wallet authority/security policy version across mobile platforms.

## W12.5 — Distribution qualification
- Validate packaged release metadata and checksums in CI.
- Verify no signing secrets or wallet secrets are packaged.
- Require W11 physical-device evidence gate before production release readiness can pass.

## W12.6 — Release candidate closeout
- Reconcile with current parent branch/main as appropriate.
- Run Wallet Mobile and Integrated qualification on the release-candidate head.
- Prepare release candidate for authorized Play/TestFlight distribution only after W11 device closeout is satisfied.

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
