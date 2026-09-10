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

Qualification lives in `contracts/test/GamingProtocol420Hardening.t.sol` and proves unauthorized registry mutation denial, one canonical profile per wallet/game, operator isolation, entitlement time windows, migration replay/cancel/expiry denial, cross-game attestation isolation, and absence of wallet-wide enumeration surfaces.

Dedicated required workflow: `420 Gaming Security Hardening`.

## GP-16.2 — Capability and wallet/session authority isolation

Status: COMPLETE — merged through PR #153.

Production qualification uses the real `CapabilityRegistry420`, `GamingAuthorization420` and `SmartAccount420` authority stack and proves exact component/action/game scope binding, expiry/revocation denial, two-layer SmartAccount/session authority, and registrar-safe fixed protocol component registration.

## GP-16.3 — Query/indexer privacy & canonical-RPC consistency

Status: COMPLETE — merged through PR #154.

The GP-10 query service treats indexed reads as scoped, provenance-bearing data. High-risk reads require finalized provenance and can be revalidated against canonical RPC; stale, reorged, malformed or contradictory data fails closed. Wallet-wide player activity enumeration remains forbidden.

Implementation: `services/420-gaming-query/src/query-service.js`.
Qualification: `services/420-gaming-query/test/query-service.test.js` via `420 Gaming Query`.

## GP-16.4 — Client/SDK hostile-state qualification

Status: IN PROGRESS — first slice merged through PR #155; second slice active.

Shared qualification lives in `packages/420-gaming-client-hardening` and exercises the real access integrations for High Country, The Green Road, Budtender and Smoke & Chrome.

Coverage now includes:

- unknown feature/access requirements fail closed instead of guessing;
- guest core gameplay remains available without registration or wallet state;
- disconnected wallet sessions deny only optional wallet-gated features and never routine/core play;
- revoked/unlinked wallet state downgrades to an explicit wallet-link boundary;
- expired/revoked entitlement results remain denied/null;
- each game's SDK client is pinned to its canonical `gameId` for adapter calls;
- adapter responses explicitly scoped to a different `gameId` are rejected at the shared SDK boundary;
- entitlement reads are not cached by the SDK across revocation/expiry changes;
- migration adapter failures are never automatically retried, preventing hidden duplicate migration submissions;
- hostile adapter/RPC failures propagate without converting an optional feature into access;
- cross-game poisoned results cannot grant another game's optional feature or progression;
- wallet-gated functionality remains marked optional and cannot become core progression.

Dedicated workflow: `420 Gaming Client Hardening`.

Remaining GP-16.4 closeout work:

- qualify migration consumed/replayed/error recovery semantics against the player/profile service response model;
- verify any downstream client cache implementation invalidates entitlement state on revocation/expiry rather than relying solely on the cache-free shared SDK;
- reconcile and merge the complete GP-16.4 head after all dedicated workflows are green.

## GP-16.5 — Finality, reorg and RPC failure handling

Qualify failure modes that only appear around chain operation:

- transaction submitted but not finalized;
- transaction reverted after optimistic UI state;
- short reorg removes an entitlement/claim/attestation event;
- RPC timeout/unavailability;
- chain ID mismatch;
- indexer ahead/behind canonical RPC;
- duplicate event delivery;
- finality threshold transitions.

No ownership/reward/cross-game state is treated as canonical solely from an optimistic client event.

## GP-16.6 — Four-game adversarial E2E gate

Final GP-16 qualification must run the same hostile cases through all four reference integrations and prove:

- guest -> registered -> wallet-linked transitions remain deliberate;
- no game can escalate authority into another game;
- no wallet-wide player-activity enumeration is introduced;
- no web3 feature becomes required for ordinary progression;
- revoked/expired/reorged state consistently fails closed;
- SmartAccount420/CapabilityRegistry420 remains the sole product authority/session boundary.

## Exit criteria

GP-16 is complete only when:

1. GP-16.1 through GP-16.6 are implemented;
2. dedicated security/privacy workflows are green on the exact reconciled head;
3. no unresolved critical/high security finding remains;
4. four-game adversarial qualification is green;
5. documentation records any accepted residual risk and operational assumptions.

After GP-16, proceed to **420GP-17 — Developer Portal / Game Onboarding**.
