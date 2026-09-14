# 420GP-16 — Security & Privacy Hardening

## Status

**COMPLETE — merged through PR #160.**

GP-16.1 through GP-16.6 are implemented and the final four-game adversarial E2E gate passed on the exact reconciled PR #160 head before merge.

The security/privacy hardening phase now closes with the following guarantees established across the shared Gaming Protocol and the four reference games:

- core gameplay remains wallet-free;
- wallet linkage is optional and explicit;
- on-chain state contains commitments/entitlements/attestations, not raw saves or guest state;
- game authority is scoped to the exact game/action boundary;
- cross-game verification is explicit and scoped, never wallet-wide activity enumeration;
- missing, expired, revoked, mismatched, reorged, non-finalized or unauthorized state fails closed;
- SmartAccount420 and CapabilityRegistry420 remain the product authority/session boundary;
- optimistic client/indexer state cannot become canonical ownership, reward, claim, entitlement or cross-game state without canonical finality.

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

Status: COMPLETE — merged through PR #158.

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

## GP-16.6 — Four-game adversarial E2E gate

Status: COMPLETE — merged through PR #160.

The final GP-16 gate runs the same hostile-state assumptions through High Country, The Green Road, Budtender and Smoke & Chrome.

Coverage includes:

- deliberate guest -> registered -> wallet-linked progression;
- ordinary/core gameplay remains available without a wallet;
- wallet-only capabilities remain optional and deny safely while unlinked or disconnected;
- each SDK client remains pinned to its canonical game namespace;
- cross-game poisoned entitlement responses fail closed;
- no wallet-wide history/entitlement/claim enumeration surface appears in reference clients;
- short reorg and insufficient-finality states cannot become canonical ownership/reward state;
- canonical finalized state is the only accepted high-risk chain state;
- existing GP-16 authority qualification remains the source of truth that SmartAccount420/CapabilityRegistry420 is the sole product authority/session boundary.

Implementation: `packages/420-gaming-client-hardening/test/four-game-e2e.test.js`.
Dedicated workflow: `420 Gaming Four-Game E2E`.

Final PR #160 qualification on exact reconciled head `d501969babb7d0d9dd4418f358a1f27a8288c92e`:

- 420 Gaming Four-Game E2E #2 — PASS;
- 420 Gaming Client Hardening #6 — PASS;
- 420 Gaming Security Hardening #14 — PASS;
- 420 Integrated Qualification #1850 — PASS.

PR #160 merged to `main` at merge commit `68c50d5bc0b5ae43b1a5abed2d29de46a4bb3222`.

## Exit criteria

Status: SATISFIED.

- GP-16.1 through GP-16.6 implemented;
- dedicated security/privacy workflows green on the exact reconciled heads used for merge;
- four-game adversarial qualification green;
- no unresolved critical/high finding identified in the GP-16 qualification work;
- residual operational assumptions documented in the GP-16.5 and GP-16.6 sections.

## Next phase

Do **not** begin 420GP-17 as a standalone gaming portal.

First complete the **420 Developer Hub core foundation** so GP-17 lands inside the permanent ecosystem-wide developer surface rather than becoming a parallel onboarding stack.

Developer Hub foundation should establish the shared developer account/project model, application registration, environment/configuration management, SDK/API discovery, capability/permission wiring, documentation/package catalogue, deployment metadata, and basic portal shell/navigation.

After that foundation exists, proceed to **420GP-17 — Developer Portal / Game Onboarding** as the gaming-specific onboarding layer inside the Developer Hub.
