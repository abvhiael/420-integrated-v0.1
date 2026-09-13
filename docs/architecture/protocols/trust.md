---
title: 420 Trust protocol
 audience:
  - developer
  - architect
  - operator
category: architecture
status: current
version: current
---

# 420 Trust protocol

420 Trust is the canonical domain-scoped evidence and reputation-signal protocol for 420 Integrated. It records authenticated facts and measurements about subjects without creating a universal social, credit, political, financial or behavioral score.

## Authority boundary

420 Identity answers who or what an entity is and which credentials it holds. 420 Trust records verifiable protocol history about a referenced subject. Neither protocol may silently absorb the other's authority. Trust signals do not create Wallet authority, custody, governance weight, validator weight, bridge authority, oracle-routing authority or Identity credentials.

## Canonical components

- `TrustIssuerRegistry420` owns issuer identity, operator, active state and epoch.
- `TrustPolicyRegistry420` owns domains, metrics, units, revisions and exact issuer-to-metric authorization.
- `TrustSignalRegistry420` owns immutable signals, corrections, revocations and replay protection.
- `TrustAggregator420` exposes deterministic per-subject/per-metric active sum and count.
- `ITrust420` is the stable consumer read boundary.

A consumer should bind to the exact metric/domain it needs. There is no protocol-wide score endpoint.

## Signal lifecycle

A signal is accepted only for an active issuer whose current operator is authorized for the exact active metric. Signal IDs are single-use and the issuer/subject/metric/evidence tuple is replay-protected. Every signal pins the metric revision and issuer epoch applicable when recorded.

Corrections are append-only: the predecessor remains readable and points to its replacement. Revocation removes an active signal from aggregation exactly once without deleting history. Disabling an issuer blocks future mutations without erasing previously valid evidence.

## Privacy and security

Canonical Trust state contains typed identifiers, values, commitments/references and timestamps needed for verification. Sensitive plaintext such as KYC records, addresses, health data, private review text or unrelated personal information belongs off-chain.

Security-critical invariants include exact issuer/metric authorization, replay protection, append-only correction, aggregate conservation, domain separation, Identity separation, prospective issuer disable and historical reconstructability.

## Integration rules

Applications must never convert Trust output into hidden universal ranking semantics. A policy using Trust evidence must identify the exact metric, domain, revision and interpretation it applies. Derived UX scores remain application policy, not canonical Trust truth.

Indexer/Search/Analytics views are rebuildable projections. When authoritative interpretation matters, read canonical Trust state or `ITrust420` and preserve source/version context.

## Source model

The frozen implementation model remains `docs/420-TRUST-V1-MODEL.md`. This governed page owns 420Docs architecture placement and integration boundaries; it does not supersede protocol contracts or generated reference material.

## Related documentation

- [420 Trust developer integration](../../developers/trust-integration.md)
- [420 Trust troubleshooting](../../troubleshooting/trust.md)
- [Trust boundary model](../trust-boundary-model.md)
- [Registry, Names, Identity and 420-IS](registry-names-identity-420is.md)
