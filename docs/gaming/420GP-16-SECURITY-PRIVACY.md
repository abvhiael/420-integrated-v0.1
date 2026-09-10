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

Status: CLOSEOUT IN QUALIFICATION — PR #155 and PR #156 merged; migration closeout active.

Shared qualification exercises the real access integrations for High Country, The Green Road, Budtender and Smoke & Chrome.

Coverage includes:

- unknown feature/access requirements fail closed;
- guest core gameplay remains wallet-free;
- disconnected or revoked wallet state denies only optional web3 features;
- canonical game IDs are enforced on both SDK requests and explicitly scoped adapter responses;
- cross-game response poisoning fails closed;
- entitlement reads are not cached by the shared SDK and therefore re-read current adapter state after revocation/expiry;
- hostile adapter/RPC errors propagate without becoming access;
- migration submission is never silently auto-retried by the SDK;
- player/profile migration preparation is idempotent for the same account + game + guest-state commitment + migration-payload hash;
- replay recovery returns the canonical existing migration instead of creating duplicate ownership paths;
- claim issuance is idempotent only for the same canonical claim ID and rejects alternate-claim replay;
- consumed migrations are one-way and duplicate acknowledgement of the same claim is safely recoverable;
- no downstream entitlement cache implementation currently exists in the four reference clients; future caches must preserve revocation/expiry invalidation semantics.

Dedicated workflows include `420 Gaming Client Hardening`, the shared Gaming SDK workflow, player/profile service qualification, cross-game qualification, reference-game integrations, Gaming Security Hardening and Integrated Qualification.

GP-16.4 is complete once this migration closeout head is reconciled and all triggered workflows are green.

## GP-16.5 — Finality, reorg and RPC failure handling

Qualify transaction submission/finality, optimistic rollback, short reorgs, RPC failure, chain ID mismatch, indexer/RPC disagreement, duplicate event delivery and finality transitions. No ownership/reward/cross-game state is canonical solely from optimistic client state.

## GP-16.6 — Four-game adversarial E2E gate

Final GP-16 qualification must prove deliberate guest -> registered -> wallet-linked transitions, no cross-game authority escalation, no wallet-wide activity enumeration, wallet-free ordinary progression, fail-closed revoked/expired/reorged state, and SmartAccount420/CapabilityRegistry420 as the sole product authority/session boundary.

## Exit criteria

GP-16 is complete only when GP-16.1 through GP-16.6 are implemented, dedicated security/privacy workflows are green on the exact reconciled head, no unresolved critical/high finding remains, four-game adversarial qualification is green, and residual risks/operational assumptions are documented.

After GP-16, proceed to **420GP-17 — Developer Portal / Game Onboarding**.
