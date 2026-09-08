# 420 Wallet — W12 Release Packaging and Distribution

W12 turns the W11 native applications and qualified release boundaries into reproducible versioned release packages for Android and iOS. W12 does not weaken the W11 physical-device closeout gate and does not place signing credentials in source control.

## W12.1 — Versioned release manifest + provenance — IN PROGRESS
- Define one canonical release manifest for Android and iOS artifacts.
- Bind release version, version code/build number, Git commit, source branch, application/bundle identifiers, minimum OS versions, artifact names, and SHA-256 digests.
- Require artifact provenance to identify the exact qualified source head.
- Keep signing identity/certificate/keystore details out of committed release metadata.
- Validate that Android APK/AAB and iOS archive metadata agree on release version and source commit.

## W12.2 — Android Play packaging
- Produce deterministic Play internal-testing package metadata.
- Verify package ID, version code, target SDK, App Links host configuration, notification permission, Data Safety checklist, and signed artifact provenance.
- Keep upload key / Play App Signing credentials external.

## W12.3 — iOS TestFlight/App Store packaging
- Produce deterministic archive/export metadata for TestFlight/App Store Connect.
- Verify bundle ID, build number, deployment target, Associated Domains, APNs entitlement, privacy manifest, and signed archive provenance.
- Keep certificates, provisioning profiles, App Store Connect API keys, and signing credentials external.

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

## Invariants
- WALLET-W12-001 — every distributed artifact is bound to an exact qualified Git commit.
- WALLET-W12-002 — artifact checksums and release metadata are reproducible and independently verifiable.
- WALLET-W12-003 — signing secrets, certificates, provisioning profiles, keystores, API keys, and wallet secrets are never committed.
- WALLET-W12-004 — packaging/distribution never becomes wallet account or signing authority.
- WALLET-W12-005 — production distribution readiness fails closed unless W11 physical-device qualification is complete.
