# 420Exchange PRE-08 — maker-only cancellation integration qualification

**Canonical roadmap:** `docs/420EXCHANGE-PRE-TESTNET-COMPLETION-ROADMAP.md`  
**Step:** PRE-08 — maker-only cancellation integration  
**Completion state:** COMPLETE  
**Qualification level:** Level 1 step-specific + Level 2 PRE-07/PRE-08 order-lifecycle integration milestone  
**Audit branch / PR:** `audit/exchange-pretestnet-phase-20260930` / PR #430  
**Audit base SHA:** `4d0ede3692efe55f04a50c7bf5b749afe579eccb`  
**Original qualified implementation SHA:** `942e1c340dde8e2a28753f4de20f4f64823e2e9a`  
**Post-PRE-10 requalified accumulated implementation SHA:** `46e97d69a51deaad9460f9145735ee1cf96f658a`  
**Current repository `main` observed at requalification:** `df8f639d8f43b763298c8750ef49d3e5849c597c`

## Canonical requirements

| Requirement | Disposition |
| --- | --- |
| Distinguish off-chain withdrawal from on-chain nonce/hash cancellation | SATISFIED — off-chain withdrawal is a versioned maker-authorized service operation with `OFFCHAIN_WITHDRAWAL` provenance; on-chain HASH and NONCE cancellation construct settlement-contract transactions. |
| Verify current maker and remaining amount before preparing cancellation | SATISFIED — PRE-08 requires the connected PRE-02 wallet to equal the canonical maker and reads canonical settlement state before producing the review. |
| Fresh state immediately before guarded send | SATISFIED — service state and settlement state are reread immediately before submission, then the exact cancellation transaction is freshly simulated/gas-estimated before the independent default-OFF wallet boundary. |
| Bind cancellation review to exact order hash/nonce/account/chain | SATISFIED — the review additionally binds exact remaining sell amount and service revision. Confirmation must echo all bound fields. |
| Racing fill / duplicate cancel / rejected / reverted / replaced / reorged outcomes | SATISFIED — racing fills and duplicate cancellation fail before wallet access; wallet rejection is explicit REJECTED; RPC/index lifecycle maps REVERTED, REPLACED, DROPPED, REORGED and conflicts deterministically. |
| Prohibit cross-account cancellation and stale maker state | SATISFIED — maker mismatch fails at preparation/build; PRE-02 account/provider/chain invalidation destroys pending cancellation authority. |
| Mock settlement/indexer conflict tests | SATISFIED — deterministic mock E2E tests cover settlement fill drift, prior cancellation, provider switch, replacement evidence, reorg and RPC/indexer disagreement. |

## Implemented cancellation paths

### Off-chain withdrawal

`POST /v1/orders/{orderHash}/withdraw`

The order service requires:

- canonical order hash;
- exact maker;
- exact nonce;
- bounded request ID;
- configured maker withdrawal authorization verifier.

The result is idempotent and records `cancellation.mode = OFFCHAIN_WITHDRAWAL`. No wallet or chain transaction is involved.

### On-chain cancellation

PRE-08 supports two explicit modes:

- `HASH` -> `cancelOrder(LimitOrder)`
- `NONCE` -> `cancelNonce(uint256)`

Both require the connected wallet to be the maker. The cancellation review binds:

- canonical order hash;
- nonce;
- maker/account;
- chain;
- current remaining raw sell amount;
- service revision.

Immediately before send, PRE-08 rereads the service projection and settlement state, rejects any racing fill or prior cancellation, reruns transaction preflight, and only then reaches the existing independent submission gate.

## Hard-off defaults

Checked-in runtime pins:

- `execution.orderWithdrawal = DISABLED_PRETESTNET`
- `execution.orderCancellation = DISABLED_PRETESTNET`

Wallet submission remains default-OFF. `PRE08_MOCK` exists only as an explicit deterministic qualification capability. Real live cancellation remains deferred.

## Principal files

- `exchange/order-service/schemas/order-withdrawal-v1.json`
- `exchange/order-service/src/order-store.js`
- `exchange/order-service/src/http.js`
- `exchange/order-service/test/publication.test.js`
- `exchange/order-service/test/http.test.js`
- `exchange/web/core/order-publication-client.js`
- `exchange/web/core/limit-order-cancellation-controller.js`
- `exchange/web/core/wallet-execution.js`
- `exchange/web/runtime-config.json`
- `exchange/web/test/pre08-limit-order-cancellation.test.js`
- `exchange/web/test/order-publication-client.test.js`
- `exchange/web/scripts/check-pre08.mjs`
- `exchange/web/package.json`

## Level 1 qualification

### Current accumulated-app requalification

After PRE-09/PRE-10 completed and PRE-07 was explicitly revalidated, PRE-08 was reopened against current repository truth.

Exact accumulated implementation SHA:

`46e97d69a51deaad9460f9145735ee1cf96f658a`

Required app-specific workflow:

- **420Exchange Web Verification**
- run `36802037691`
- run number `730`
- event: `pull_request`
- exact head: `46e97d69a51deaad9460f9145735ee1cf96f658a`
- **SUCCESS**

That exact accumulated run re-exercised:

- PRE-07/PRE-08 order-service static/unit/HTTP qualification — SUCCESS;
- PRE-08 cancellation static checks — SUCCESS;
- complete Exchange web unit/integration suite, including maker/cross-account/remaining-amount/racing-fill/duplicate-cancel/default-OFF coverage — SUCCESS;
- rejected/reverted/replaced/reorg/indexer-conflict cancellation lifecycle tests — SUCCESS;
- PRE-10 read-service contract/integration tests — SUCCESS;
- complete 420Indexer shared-dependency test suite — SUCCESS;
- retained PRE-02/PRE-03 Chromium acceptance — SUCCESS;
- frontend secret scan — SUCCESS.

The requalification confirms that PRE-09/PRE-10 did not weaken maker-only authority, fresh settlement-state checks, racing-fill rejection, duplicate-cancel protection, lifecycle reconciliation, or default-OFF withdrawal/cancellation behavior.

No executable PRE-08 remediation was required.

### Original PRE-08 closeout

Exact original implementation SHA:

`942e1c340dde8e2a28753f4de20f4f64823e2e9a`

**420Exchange Web Verification**

- run `36798755313`
- run number `695`
- event: `pull_request`
- exact head: `942e1c340dde8e2a28753f4de20f4f64823e2e9a`
- **SUCCESS**

Successful checks included:

- retained quote-service static/unit/HTTP checks and secret scan;
- PRE-07/PRE-08 order-service static/unit/HTTP checks;
- PRE-08 browser static checks;
- full Exchange web unit/integration suite;
- maker/cross-account/remaining-amount/racing-fill/duplicate-cancel/default-OFF tests;
- rejected/reverted/replaced/reorg/indexer-conflict cancellation lifecycle tests;
- browser artifact build/verification;
- retained PRE-02 Chromium acceptance;
- retained PRE-03 Chromium acceptance;
- frontend secret scan.

## Level 2 order-lifecycle milestone

**COMPLETE.**

PRE-07 publication/status and PRE-08 withdrawal/cancellation now converge into one retained Exchange order lifecycle:

`review -> signed fixture -> publication -> accepted/partial -> cancellation review -> off-chain withdrawal OR guarded on-chain hash/nonce cancel -> lifecycle reconciliation`

The exact-head retained Exchange workflow validates the service and browser layers together. No repository-wide Level 3 reconciliation was run.

## Exit criterion

> cancellation is deterministic and mock-E2E qualified; sends remain hard-off.

**SATISFIED.**

Cancellation behavior is deterministic across off-chain and on-chain paths, canonical maker/order identity is enforced, state is refreshed at the send boundary, mock settlement/indexer conflict cases are qualified, and real sends remain default-OFF.

## Main divergence

At post-PRE-10 PRE-08 requalification, current `main` was `df8f639d8f43b763298c8750ef49d3e5849c597c`, 80 commits beyond the audit base.

Those main-side commits do not modify:

- `exchange/web/**`;
- `exchange/order-service/**`;
- `exchange/read-service/**`;
- `420-indexer/**`;
- `.github/workflows/exchange-web.yml`.

There is therefore no upstream PRE-08 implementation conflict requiring step-local reconciliation. Full branch reconciliation remains deferred to PRE-12.

## Deferred Level 3 / live work

Deferred to PRE-12 or live-testnet qualification:

- repository-wide Solidity/Genesis/420 Integrated/Geth/Docs reconciliation;
- final exact-head monolithic merge-candidate qualification;
- real wallet cancellation transaction;
- live service withdrawal authentication deployment;
- live settlement/indexer confirmation and replacement evidence;
- production endpoint/deployment configuration.

PR #430 remains draft and unmerged.

## Post-PRE-10 requalification conclusion

**PRE-08 remains COMPLETE.**

All original canonical exit criteria remain satisfied on the accumulated Exchange implementation. PRE-10 now supplies the repository-owned V13 `CANCELLATION` projection surface consumed by lifecycle reconciliation, but that data remains explicitly non-authoritative; maker identity, fill/cancel freshness and cancellation authority continue to come from the qualified order-service/settlement/session boundaries.

No executable PRE-08 remediation was required. Current requalification is retained at implementation SHA `46e97d69a51deaad9460f9145735ee1cf96f658a` using Exchange workflow run `36802037691` / #730.

## Next step in the roadmap's recommended dependency order

PRE-07 + PRE-08 are now both explicitly revalidated. The roadmap then proceeds to **PRE-09**, which is already COMPLETE.

The next **unfinished** canonical roadmap step is **PRE-11 — CI/security/packaging/operations closure.**
