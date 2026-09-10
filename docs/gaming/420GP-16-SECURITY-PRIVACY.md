# 420GP-16 — Security & Privacy Hardening

## Objective

Harden the shared 420 Gaming Protocol and its client/query integrations against hostile authority, replay, expiry, privacy-enumeration and inconsistent-state failures before developer onboarding is opened in 420GP-17.

GP-16 preserves the access model established in GP-1 through GP-15:

- core gameplay remains wallet-free;
- wallet linkage is optional and explicit;
- on-chain state contains commitments/entitlements/attestations, not raw saves or guest state;
- game authority is scoped to the exact game/action boundary;
- cross-game verification is explicit and scoped, never wallet-wide activity enumeration;
- missing, expired, revoked, mismatched or unauthorized state fails closed.

## GP-16.1 — Core contract adversarial qualification

Status: COMPLETE — merged through PR #150.

## GP-16.2 — Capability and wallet/session authority isolation

Status: COMPLETE — merged through PR #153.

## GP-16.3 — Query/indexer privacy & canonical-RPC consistency

Status: COMPLETE — merged through PR #154.

## GP-16.4 — Client/SDK hostile-state qualification

Status: COMPLETE — merged through PR #157.

Shared qualification exercises the real access integrations for High Country, The Green Road, Budtender and Smoke & Chrome.

Coverage includes unknown feature/access failure, wallet-free core play, safe downgrade of disconnected/revoked wallet state, canonical game namespace enforcement, cross-game response poisoning denial, cache-free entitlement reads, hostile adapter/RPC failure propagation, idempotent migration preparation/recovery, replay-safe claim issuance/consumption, and no downstream entitlement cache in the four reference clients.

## GP-16.5 — Finality, reorg and RPC failure handling

Status: CLOSEOUT IN QUALIFICATION — PR #158.

The shared finality model lives beside the production gaming query layer and is wired into the consumable high-risk read path.

Coverage includes:

- submitted transactions remain pending until canonical receipt/finality exists;
- reverted optimistic state fails closed;
- short reorgs reject a prior receipt block hash;
- RPC unavailability/timeouts fail closed;
- chain ID mismatch fails closed;
- indexer ahead/behind canonical RPC suppresses high-risk consumption;
- duplicate event delivery is classified non-canonical for re-application;
- confirmation thresholds transition state from pending to finalized;
- entitlement, claim and attestation reads can require live finality through `finalityResolver`;
- finality resolver exceptions return `null` instead of leaking optimistic state;
- standard-risk game/profile reads remain independent from the live high-risk finality hook;
- no ownership, reward, claim, entitlement or cross-game state becomes canonical solely from optimistic client/indexer state.

Implementation: `services/420-gaming-query/src/finality-state.js` and `services/420-gaming-query/src/query-service.js`.
Qualification: `services/420-gaming-query/test/finality-state.test.js` and `services/420-gaming-query/test/query-service.test.js` through `420 Gaming Query` and Integrated Qualification.

GP-16.5 is complete once the exact reconciled PR #158 head is green and merged.

## GP-16.6 — Four-game adversarial E2E gate

Final GP-16 qualification must prove deliberate guest -> registered -> wallet-linked transitions, no cross-game authority escalation, no wallet-wide activity enumeration, wallet-free ordinary progression, fail-closed revoked/expired/reorged state, and SmartAccount420/CapabilityRegistry420 as the sole product authority/session boundary.

## Exit criteria

GP-16 is complete only when GP-16.1 through GP-16.6 are implemented, dedicated security/privacy workflows are green on the exact reconciled head, no unresolved critical/high finding remains, four-game adversarial qualification is green, and residual risks/operational assumptions are documented.

After GP-16, complete the Developer Hub core foundation before proceeding to **420GP-17 — Developer Portal / Game Onboarding**.
