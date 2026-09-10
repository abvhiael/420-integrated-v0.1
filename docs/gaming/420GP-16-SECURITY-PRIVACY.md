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

Qualification lives in `contracts/test/GamingProtocol420Hardening.t.sol` and proves:

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

Status: COMPLETE — merged through PR #153.

Production qualification lives in `contracts/test/GamingProtocol420AuthorityIsolation.t.sol` and uses the real `CapabilityRegistry420`, `GamingAuthorization420` and `SmartAccount420` authority stack.

Coverage includes:

- exact `COMPONENT_GAMING` component binding;
- exact action ID binding for register/update/status operations;
- exact per-game scope binding;
- wrong component, wrong game scope and wrong action denial;
- expired/revoked capability denial;
- SmartAccount420 session execution requires both the account's selector-scoped session grant and a separate exact gaming capability for the SmartAccount principal;
- session principals do not inherit or manufacture gaming protocol authority;
- SmartAccount component IDs remain self-managed and cannot be overwritten by the protocol-component registrar;
- no parallel gaming private-key/session-authority subsystem is introduced.

### GP-16.2 production authority remediation

GP-16.2 identified that `CapabilityRegistry420` previously had no safe production path to register fixed protocol component IDs such as `GamingIds420.COMPONENT_GAMING`; only deterministic SmartAccount component IDs could be registered. Without remediation, a production gaming grant for `COMPONENT_GAMING` could never be created.

The remediation added a backward-compatible protocol-component registrar model:

- the registry deployer becomes the initial `componentRegistrar`;
- only the registrar can register fixed protocol component IDs and their grant-authority address;
- protocol-managed component authority can be rotated only by the registrar;
- registrar authority itself can be transferred;
- a registrar cannot claim an already-registered SmartAccount component ID;
- SmartAccount component registration remains deterministic and self-managed;
- grant creation remains default-deny and still requires the exact current component authority.

## GP-16.3 — Query/indexer privacy & canonical-RPC consistency

Status: COMPLETE — merged through PR #154.

The GP-10 query service now treats indexed reads as scoped, provenance-bearing data rather than implicitly canonical state.

Coverage includes:

- no API can enumerate all activity for a wallet across games;
- profile, entitlement, claim and attestation lookups require explicit game/scope identifiers;
- adapter-returned indexed records include `blockNumber`, `blockHash` and `finalized` provenance;
- missing or malformed provenance fails closed;
- entitlement, claim and attestation reads are treated as high-risk and require finalized indexed provenance;
- optional canonical RPC revalidation rejects non-canonical, reorged or contradictory indexed state;
- canonical block number/hash mismatches fail closed;
- no raw guest saves, signer material or migration payload plaintext is added to query-layer state or logging.

Implementation: `services/420-gaming-query/src/query-service.js`.
Qualification: `services/420-gaming-query/test/query-service.test.js` via `420 Gaming Query`.

## GP-16.4 — Client/SDK hostile-state qualification

Status: IN PROGRESS.

Shared qualification lives in `packages/420-gaming-client-hardening` and exercises the real access integrations for High Country, The Green Road, Budtender and Smoke & Chrome.

Current GP-16.4 coverage requires:

- unknown feature/access requirements fail closed instead of guessing;
- guest core gameplay remains available without registration or wallet state;
- disconnected wallet sessions deny only optional wallet-gated features and never routine/core play;
- revoked/unlinked wallet state downgrades to an explicit wallet-link boundary;
- expired/revoked entitlement adapter results remain `null` and are not converted into access;
- each game's SDK client is pinned to its canonical `gameId` for profile and entitlement adapter calls;
- no game client can inject a different game namespace through public SDK method arguments;
- wallet-gated functionality remains marked optional and cannot become core progression.

Dedicated workflow: `420 Gaming Client Hardening`.

Remaining GP-16.4 work after this slice:

- migration replay/error recovery qualification without duplicate ownership;
- cached entitlement invalidation after a previously valid result becomes revoked/expired;
- cross-game response poisoning tests proving no core statistical/economic advantage;
- hostile adapter/RPC error qualification across all four clients.

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
