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

Status: IN PROGRESS

Qualification lives in `contracts/test/GamingProtocol420Hardening.t.sol` and must prove:

1. unauthorized registry updates and status changes fail closed;
2. one canonical profile per wallet/game cannot be replaced;
3. non-operators cannot issue or revoke entitlements;
4. entitlement `validFrom` / `validUntil` windows fail closed;
5. migration claims require the target account and canonical profile;
6. consumed claims cannot replay;
7. cancelled and expired claims cannot be consumed;
8. non-operators cannot issue or revoke cross-game attestations;
9. expired/revoked attestations fail closed;
10. protocol contracts expose no wallet-wide profile/claim/attestation enumeration surface.

Dedicated required workflow: `420 Gaming Security Hardening`.

## GP-16.2 — Capability and wallet/session authority isolation

Verify `GamingAuthorization420` against the production `CapabilityRegistry420` semantics rather than a permissive mock. Required coverage:

- exact `COMPONENT_GAMING` component binding;
- exact action ID binding for register/update/status operations;
- exact per-game scope binding;
- wrong game scope denial;
- wrong action denial;
- expired/revoked capability denial;
- SmartAccount420/session-key authority can authorize only the intended scoped gaming action;
- no parallel gaming private-key/session-authority subsystem is introduced.

## GP-16.3 — Query/indexer privacy & canonical-RPC consistency

Harden the GP-10 query layer:

- no API can enumerate all activity for a wallet across games;
- profile/entitlement/attestation lookups require explicit game/scope identifiers;
- cached/indexed state carries canonical block/finality metadata;
- high-risk reads can revalidate against canonical RPC;
- stale, reorged or contradictory indexer state fails closed;
- retention/logging does not persist raw guest saves, signer material or migration payload plaintext.

## GP-16.4 — Client/SDK hostile-state qualification

Across High Country, The Green Road, Budtender and Smoke & Chrome:

- unknown access states fail closed;
- optional wallet prompts cannot block routine/core gameplay;
- disconnected/revoked wallet sessions downgrade safely;
- expired/revoked entitlements do not remain unlocked from cache;
- migration replay/error states remain recoverable without duplicating ownership;
- cross-game checks cannot grant core statistical or economic advantage;
- one game's client cannot inject another game's namespace or authority.

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
