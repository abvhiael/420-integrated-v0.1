# 420Exchange PRE-09 — bridge proof and destination-settlement architecture qualification

**Canonical roadmap:** `docs/420EXCHANGE-PRE-TESTNET-COMPLETION-ROADMAP.md`  
**Step:** PRE-09 — bridge proof and destination-settlement architecture  
**Completion state:** COMPLETE  
**Qualification level:** Level 1 step-specific + Level 2 bridge-lifecycle integration milestone  
**Audit branch / PR:** `audit/exchange-pretestnet-phase-20260930` / PR #430  
**Audit base SHA:** `4d0ede3692efe55f04a50c7bf5b749afe579eccb`  
**Qualified implementation SHA:** `280902f41b99bf074a2c8f85406b871b9dd05984`  
**Current repository `main` observed at implementation closeout:** `df8f639d8f43b763298c8750ef49d3e5849c597c`

## Canonical requirement disposition

| Requirement | Disposition |
| --- | --- |
| Canonical route/adapter/verifier/manifest identity | SATISFIED — PRE-09 canonical manifest binds route ID, source/destination adapter IDs, verifier ID/config hash, manifest ID/version, source/destination chain IDs, source/destination/canonical asset IDs and gateway addresses into a deterministic manifest fingerprint. |
| Separate source submission/finality, proof availability/verification, destination claim/finality | SATISFIED — the lifecycle exposes distinct states and transition guards for every stage. |
| Provider-neutral proof-provider interface | SATISFIED — proof acquisition and proof verification are separate injected interfaces; neither is inferred from source receipts. |
| Bind beneficiary, chains, asset representation, amount and replay domain | SATISFIED — canonical transfer and proof validation bind all fields plus route/adapters/verifier/manifest fingerprint/source tx/block/message. |
| Pause, expiry, proof invalidation, reorg, refund/recovery and retry-safe states | SATISFIED — all are explicit lifecycle states/transitions with terminal-state protections. |
| Persist/reconcile lifecycle through indexed events | SATISFIED — lifecycle transitions are written through a provider-neutral state-store interface; indexed projection records reconcile canonical/delayed/conflicting/reorged states without becoming settlement authority. |
| Two-chain mock/offline E2E proves beneficiary payout and replay rejection | SATISFIED — deterministic source chain `0x420` → destination chain `0x421` fixture validates exact beneficiary/asset/amount/transfer payout and rejects reuse of the same replay domain/source message. |

## Architecture implemented

`exchange/web/core/bridge-lifecycle.js` adds the offline-testable PRE-09 bridge architecture around the existing canonical bridge contracts and V15.8 live qualification primitives.

### Canonical identity

The bridge manifest binds:

- route ID;
- source and destination adapter IDs;
- verifier ID and verifier configuration hash;
- manifest ID/version;
- source and destination chain IDs;
- source, destination and canonical asset IDs;
- source and destination GatewayRouter addresses.

A deterministic `manifestFingerprint` prevents route/adapter/verifier/asset substitution.

The canonical transfer additionally binds:

- sender;
- beneficiary;
- raw amount;
- replay domain;
- expiry.

### Lifecycle

The state machine separates:

`DRAFT -> SOURCE_READY -> SOURCE_SUBMITTED -> SOURCE_FINALIZED -> PROOF_PENDING -> PROOF_AVAILABLE -> PROOF_VERIFIED -> DESTINATION_READY -> DESTINATION_SUBMITTED -> DESTINATION_FINALIZED -> SETTLED`

Failure/recovery states include:

- `PAUSED`
- `EXPIRED`
- `PROOF_INVALIDATED`
- `SOURCE_REORGED`
- `DESTINATION_REORGED`
- `REFUND_PENDING`
- `REFUNDED`
- `RETRYABLE`
- `FAILED`
- `INDEXER_DELAYED`
- `INDEXER_CONFLICTING`

### Proof authority

PRE-09 deliberately separates proof acquisition from proof verification.

`createProofProviderAdapter()` supplies source-bound proof material. The returned proof must bind the exact finalized source transaction, source block, source message, route, source/destination adapters, verifier, manifest fingerprint, chains, beneficiary, amount, asset representations and replay domain.

`createProofVerifierAdapter()` is a separate verifier authority. A structurally bound proof cannot advance from `PROOF_AVAILABLE` to `PROOF_VERIFIED` unless that verifier returns a valid verdict.

### Replay protection

`bridgeReplayKey()` binds replay domain, manifest fingerprint, sender, beneficiary, amount and source message ID. The mock replay guard is consumed only after exact destination settlement evidence is accepted.

The repository's canonical on-chain `BridgeTransferRegistry` remains the actual live-chain replay authority; PRE-09 does not replace it.

### Destination settlement

`confirmSettlement()` requires exact:

- beneficiary;
- raw amount;
- destination asset representation;
- canonical destination transfer ID;
- positive payout state.

`InboundAccepted` or an indexed projection alone is not sufficient to mark the transfer `SETTLED`.

### Persistence and projection reconciliation

`createMemoryBridgeLifecycleStore()` defines the state-store contract used by deterministic qualification; the controller writes every lifecycle transition through the store interface.

`reconcileBridgeProjection()` and the injected projection reader validate indexed events/projections for:

- beneficiary conflicts;
- amount conflicts;
- route conflicts;
- destination asset conflicts;
- source reorg evidence;
- destination reorg evidence.

Indexed data remains projection evidence, not settlement authority.

This is intentionally provider-neutral so PRE-10 can supply the production Exchange projection/API implementation without changing PRE-09 lifecycle semantics.

## Hard-off defaults

Checked-in runtime pins:

- `execution.bridgeSubmission = DISABLED_PRETESTNET`
- `execution.bridgeProofAcceptance = DISABLED_PRETESTNET`

The PRE-09 offline lifecycle module contains no `eth_sendTransaction` capability and no live-testnet qualification gate. Existing V15.8 live bridge submission remains a separately protected live-testnet harness.

## Principal files

- `exchange/web/core/bridge-lifecycle.js`
- `exchange/web/test/pre09-bridge-lifecycle.test.js`
- `exchange/web/scripts/check-pre09.mjs`
- `exchange/web/runtime-config.json`
- `exchange/web/package.json`

Existing bridge contracts and V15.8 live qualification primitives are preserved.

## Level 1 qualification

Exact implementation SHA:

`280902f41b99bf074a2c8f85406b871b9dd05984`

**420Exchange Web Verification**

- run `36800092528`
- run number `711`
- event: `pull_request`
- exact head: `280902f41b99bf074a2c8f85406b871b9dd05984`
- **SUCCESS**

Successful checks included:

- retained quote-service static/unit/HTTP checks and secret scan;
- retained order-service static/unit/HTTP checks;
- Exchange static checks including PRE-09 bridge architecture;
- full Exchange web unit/integration suite;
- two-chain source→proof→destination→settlement mock E2E;
- exact beneficiary/asset/amount settlement checks;
- replay rejection;
- proof substitution/adversarial binding checks;
- provider-neutral proof-verifier rejection;
- lifecycle state-store persistence;
- pause/resume/expiry/proof invalidation;
- source/destination reorg handling;
- refund/recovery/retry states;
- indexed projection delay/conflict/reorg checks;
- browser artifact build and verification;
- retained PRE-02 Chromium acceptance;
- retained PRE-03 Chromium acceptance;
- frontend secret scan.

## Level 2 bridge-lifecycle milestone

**COMPLETE.**

PRE-09 introduces a material cross-chain authority boundary spanning:

`reviewed transfer -> source finality -> external proof acquisition -> independent proof verification -> destination claim/finality -> exact beneficiary settlement -> replay/indexer reconciliation`

The exact-head retained Exchange suite validates the accumulated browser/service architecture alongside PRE-02 through PRE-08. No repository-wide Level 3 reconciliation was performed.

## Dependency on PRE-10

PRE-09's canonical dependency on the PRE-10 projection/API contract is respected rather than silently bypassed.

The PRE-09 lifecycle uses an explicit provider-neutral `projectionReader` contract and treats indexed records only as non-authoritative reconciliation evidence. The production Exchange API/Indexer adapter that supplies this interface remains PRE-10 work.

That does not block PRE-09's stated exit criterion: the complete source-to-destination lifecycle is mockable and independently qualified without fabricating a production projection service.

## Exit criterion

> complete mockable source-to-destination state machine; real bridge submission/proof/payout deferred.

**SATISFIED.**

The complete cross-chain lifecycle is offline-testable with deterministic state transitions, independent proof acquisition/verification, exact destination payout validation, replay rejection, state persistence and indexed reconciliation. Real bridge submission, live proof validation and beneficiary payout remain hard-off/deferred.

## Main divergence / Level 3

At implementation closeout current `main` was:

`df8f639d8f43b763298c8750ef49d3e5849c597c`

The branch was 198 commits ahead and 80 commits behind `main`, with merge base:

`4d0ede3692efe55f04a50c7bf5b749afe579eccb`

Full reconciliation remains intentionally deferred to PRE-12.

Deferred Level 3 work includes repository-wide Solidity/Genesis, 420 Integrated, applicable Geth, Docs/global reconciliation, final deployment/config verification and exact-head monolithic merge-candidate qualification.

PR #430 remains draft and unmerged.

## Next canonical roadmap step

**PRE-10 — Exchange read API / Indexer adapter and startup composition.**
