# BET-AUDIT-7 — Ecosystem integrations (work in progress)

**Canonical sequence:** BET-AUDIT-6 user-facing website → **BET-AUDIT-7 ecosystem integrations** → BET-AUDIT-8 deployment/documentation → BET-AUDIT-9 qualification → BET-AUDIT-10 Level 3 → BET-AUDIT-11 testnet/release acceptance. This file is a scoped implementation ledger, not a replacement for the canonical roadmap or an authorization to accept wagers.

**Disposition: OPEN / NOT QUALIFIED.** This branch implements a read-only event-reconciliation primitive and tests. It does not claim live provider bindings, complete cross-app integrations, cross-game Level 2, Level 3, deployability, approval of economics, or verified production/testnet receipts. All dependent funded betting remains disabled unless separately approved under `docs/420BET-TESTNET-WORK-ROADMAP.md`.

## Required ecosystem integration work and ownership

| Boundary | Work required for BET-AUDIT-7 exit | Current evidence / gap |
| --- | --- | --- |
| Canonical casino/poker/fantasy/sportsbook contracts → 420Indexer | Exact ABI/event inventory per game version; match chain ID, emitting contract, tx receipt, block hash, safe/final head, and settlement/void lifecycle; explicit rebuild from deploy height, replay and rollback on reorg | Existing `server/history.mjs` reads scoped indexer transaction/receipt/block routes. Those transactions **do not establish** game outcome or payout. New `server/ecosystem.mjs` provides a game-scoped reconciliation primitive; `server/indexer-event-abi.mjs` and `server/indexer-event-reader.mjs` implement a validated Indexer v1 HTTP reader, Solidity topic0 event decoders, receipt/block provenance checks, persistent atomic checkpoints, and automatic full rebuild after tip divergence. Live endpoint/deployment/runtime-hash approval and official-network evidence remain missing |
| 420Wallet / 420Identity | Signed wallet session challenge/verification, chain/network switching, explicit account or credential revocation, age/jurisdiction and responsible-play gates under independently approved policy; never infer authorization from a connected address | Existing `src/wallet.js` and 6.2 history identity are discovery-only. Authentication/eligibility provider acceptance not complete |
| 420Registry / module manifests | Pin immutable game/ruleset/resolver/settlement addresses, runtime hashes, chain ID, deployment epoch and authority roles; reject missing/mismatched versions before integration reads or funded writes | No approved promoted manifest in this step; do not fabricate endpoints or addresses |
| 420Notifications / 420Mail | Consent- and tenant-scoped durable outbox, redacted event envelopes, idempotency keys, bounded retries/dead-letter and cancellation/revocation, reconciliation of delivery receipts | Not wired. Must not expose betting history to unauthenticated notification recipients or leak balances |
| 420Search / Explorer | Public game discovery and approved public chain provenance only, no per-user wallet-wide aggregation; invalidate orphaned results, rebuild from canonical indexer | Not wired. Search is non-authoritative |
| 420Analytics / monitoring | Privacy-minimized, structured and versioned operational telemetry; settled/voided/reorg counters reconciled against authoritative receipts, alerting for divergence and stuck recoveries; redaction/no secrets | New `projectPublicEventSummary` is a count-only local primitive, **not** live telemetry |
| Across app boundaries | Durable versioned contracts, fail-closed errors, bounded pagination and size, timeout/degraded operations, differential replay, privacy and abuse tests, audit trails and independent review | Current module covers a narrow subset; external operational E2E and compatibility matrix pending |

## Implemented in this branch

`clients/420bet-lobby/server/ecosystem.mjs` accepts *already-verified* event records injected by a future independently qualified chain/indexer adapter; it does **not** read untrusted public web callbacks or accept a browser claim of transaction settlement. A caller must verify emitting contracts, approved ABI, receipt provenance and finality **before** using it.

- Strict chain/game/account tuple and a small event-type vocabulary; malformed, out-of-range and cross-scope events are denied.
- Unsigned decimal block/log bounds, explicit safe head, normalized hashes and addresses, bounded batch size.
- Idempotent replay and a required explicit `rewindFrom` for canonical replacement. Empty replay windows remove orphaned events. Mixed block hashes or conflicting tx/log identities fail closed.
- Count-only summary without wallet identifiers or wager amount. Counters are non-authoritative visibility aids and must never alter escrow, balance, eligibility or settlement.
- `server/indexer-event-abi.mjs` computes Keccak-256 topic0 from the **actual** Solidity event ABI signatures for shared casino router/settlement, poker ledger/canonical settlement, fantasy contests and sportsbook tickets. No browser-provided event is trusted.
- `server/indexer-event-reader.mjs` reads approved-contract logs from Indexer v1 with strict chain/receipt/block identity and finality checks, cursor-opaque pagination, atomic filesystem checkpoints, startup recovery, and full rollback/rebuild if the previously committed canonical safe tip diverges. It does not grant wagering authority.
- `server/sync-indexer-events.mjs` exposes a backend-only operational command using an explicit manifest and durable private checkpoint; see `BET-AUDIT-7-INDEXER-WORKSTREAM.md`.
- `tests/ecosystem.test.mjs`, `tests/indexer-event-reader.test.mjs` and `.github/workflows/420bet-ecosystem-7-level1.yml`.

**Important limitation:** The **original in-memory** `ecosystem.mjs` module cannot independently detect chain reorgs; the new Indexer adapter implements tip-hash detection and full deterministic rollback/rebuild for its **own** checkpoint. The adapter does not independently authenticate RPC consensus, live service deployment identity, or downstream outbox/search/analytics invalidations. Its test HTTP fixtures are not official-network proof. A future consumer of the checkpoint must invalidate all orphaned projections whenever a rebuild occurs.

## Exit criteria — all must be evidenced before COMPLETE

1. Freeze a per-vertical ABI/event schema and immutable game contract/version/chain manifest, with documented ownership and a signed approval path.
2. Integrate the actual qualified Indexer/Registry/Wallet/Identity services, with deterministic reconciliation from approved checkpoints, finality/reorg detection and recovery; prove exact source provenance using real contract emission rather than synthetic event objects.
3. Implement consent-based notification/mail outbox and privacy-limited search/analytics sinks without creating transaction authority in read-only services.
4. Exercise adversarial cross-game/account/chain/version poisoning, forged receipts, reorg replacement including empty blocks, event duplication, source unavailability, replay window gaps, late/failure/retry, provider authentication, consent withdrawal, and no double credit.
5. Run full app/unit/integration and cross-game Level 2 workflows, retain **exact implementation SHA**, run IDs, test counts, and merged-main reconciliation; address any failing gate on the same SHA. Document the explicit absence of official network receipts until available.
6. Keep independently authorized funded wager activation behind legal/jurisdiction/age, economics, risk, manifest and official-testnet gates. No Level 3 or production acceptance is claimed by this step.

**Next action:** verify the new Indexer reader against an actual approved 420Indexer deployment, freeze qualified manifest/contract/runtime identities and retain operational receipts (see `BET-AUDIT-7-INDEXER-WORKSTREAM.md`). Then implement Wallet/Identity, Registry, Notifications/Mail, Search and Analytics bindings and cross-service qualification. The reader checks internally consistent Indexer v1 evidence; it does not prove independent consensus or replace a live provider acceptance. Do not promote this WIP branch as a full BET-AUDIT-7 milestone pass.
