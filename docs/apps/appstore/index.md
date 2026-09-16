---
title: 420 AppStore
audience: [user, developer]
category: application
status: development
version: current
---
# 420 AppStore

420 AppStore is the Genesis catalogue for discovering, evaluating and launching registered 420 applications. It is a **curated, non-authoritative presentation layer** over canonical Registry and chain data.

A listing does not create legitimacy, and delisting does not revoke Registry state. Featured placement, ratings, reviews, screenshots, categories and sponsorship remain presentation metadata.

Use the AppStore to inspect provenance, versions, permissions, security context and launch destinations, then rely on 420 Wallet and Smart Accounts for authorization.

## Implementation references

- [APPSTORE-0 architecture baseline](appstore-0-architecture-baseline.md) — freezes the contract-free trust boundary, canonical/non-canonical field split, privacy defaults, Wallet handoff limits and APP-INV-001 through APP-INV-013 qualification contract.
- [APPSTORE-1 service/runtime scaffold](appstore-1-runtime.md) — defines runtime configuration, canonical network/Registry startup qualification, health/readiness behavior, graceful shutdown and fail-closed service boundaries.
- [APPSTORE-2 Registry synchronization](appstore-2-registry-sync.md) — builds the replay-safe, rebuildable projection of canonical Registry identity, version, implementation and provenance history.
- [APPSTORE-3 catalogue persistence](appstore-3-catalogue-persistence.md) — adds deterministic noncanonical persistence, restart restoration, rebuild semantics, schema validation and corruption-safe failure behavior.
- [APPSTORE-4 curation and presentation metadata](appstore-4-curation.md) — enforces noncanonical categories, featured/sponsored placement, rating/review boundaries and protection against canonical-field overrides.
- [APPSTORE-5 security and provenance](appstore-5-security-provenance.md) — preserves verification, audit, publisher, trust, deprecation and malicious-warning provenance while preventing evidence from being presented as a safety or endorsement guarantee.
- [APPSTORE-6 Wallet handoff and authorization boundary](appstore-6-wallet-handoff.md) — validates deep-link context, presents requested permissions/capability scopes/high-risk actions, and rejects signatures, capability grants, token approvals or confirmation bypasses so 420Wallet/Smart Accounts remain the authorization boundary.
- [APPSTORE-7 discovery API and application views](appstore-7-discovery-api.md) — adds browse/search/categories/detail APIs and view models that keep canonical Registry provenance separate from noncanonical discovery/ranking metadata while preserving direct Registry, Explorer, Verify, Wallet and app links.
- [APPSTORE-8 privacy, abuse resistance and failure recovery](appstore-8-privacy-hardening.md) — excludes private/encrypted/raw telemetry and install/launch history, bounds metadata/media, rejects hostile links, defines privacy-preserving abuse controls, and specifies blocked/degraded behavior across Registry/RPC/Search/Verify/store failures.
- [APPSTORE-9 Genesis frontend](appstore-9-frontend.md) — adds the responsive dependency-free browse/search/category/detail UI, canonical provenance and contract/version display, permissions/scopes, security evidence and warnings, sponsorship labels, degraded-state messaging, and Open in 420Wallet handoff without moving authorization into AppStore.
- [APPSTORE-10 qualification and closeout](appstore-10-closeout.md) — verifies APP-INV-001 through APP-INV-013, deterministic rebuild behavior, readiness evidence, latest-main reconciliation, exact-head qualification and the single phase-end merge gate.
