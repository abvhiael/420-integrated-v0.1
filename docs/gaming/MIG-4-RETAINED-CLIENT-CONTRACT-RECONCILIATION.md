# MIG-4 / HC-NEXT-6.2 — Retained gaming qualification reconciliation

Following extraction of Green Road, Budtender, and Smoke & Chrome, Genesis does not own those game implementation modules. The retained R06 and gaming SDK suites must not import `clients/{greenroad,budtender,smoke-chrome}-access-v1/src/access.js`, which are no longer shipped in Genesis.

The shared `packages/420-gaming-sdk/test-support/extracted-game-contracts.js` is an explicit **contract fixture**, not a restored game implementation. It derives stable game IDs from `GAMING_GAME_IDS` and routes representative guest, registration, optional-wallet and ownership gates through the actual `evaluateAccessRequirement` and `createGamingClient420` SDK functions.

The three retained test files continue to verify: unique, canonical game IDs; namespace-scoped SDK calls; poisoned foreign-game entitlements denied; core gameplay wallet-free; cloud saves registration-gated; optional features wallet-gated; lost wallet, revoked/expired entitlements, unknown features, reorg/pending finality and hostile RPC errors failing closed. Their checks now certify **Genesis shared interface guarantees**, not the extracted game binaries.

Separate game repositories remain responsible for verifying their concrete feature mapping, client wrappers, and full end-to-end behavior against the versioned SDK/compatibility contract. This division must not be misreported as proof that external game implementations passed inside Genesis. No legacy imports were restored and no adverse assertion was deleted.

Qualification: affected 420 Gaming SDK, Client Hardening, Four-Game E2E, Cross-Game Qualification and retained R06 tests. Reuse earlier HC-NEXT-6.2 licensing-scoped passing evidence for unchanged modules where qualification policy allows it. Do not rerun unrelated Foundry or Genesis-wide gates solely to qualify these retained contract fixtures.
