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
