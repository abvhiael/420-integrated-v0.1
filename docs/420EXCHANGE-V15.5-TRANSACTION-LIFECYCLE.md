# 420Exchange V15.5 — Transaction Lifecycle, Finality & V13 Reconciliation

## Status

V15.5 adds canonical post-submission tracking for the transaction hash returned by V15.4.

Implementation:

- `exchange/web/core/transaction-lifecycle.js`
- `exchange/web/test/transaction-lifecycle.test.js`

## RPC lifecycle

The lifecycle layer inspects:

- `eth_getTransactionByHash`
- `eth_getTransactionReceipt`
- `eth_getBlockByNumber("latest")`
- `eth_getBlockByNumber("safe")`
- `eth_getBlockByNumber("finalized")`
- the exact receipt inclusion block by number

States are:

- `PENDING` — transaction is still known but has no receipt;
- `DROPPED` — neither transaction nor receipt is currently known;
- `INCLUDED` — successful canonical receipt exists but confirmation policy is not yet met;
- `CONFIRMED` — configured confirmation count is met;
- `SAFE` — receipt block is at or behind the RPC safe head;
- `FINALIZED` — receipt block is at or behind the finalized head;
- `REVERTED` — canonical receipt status is zero;
- `REORGED` — receipt block hash no longer matches the canonical block at that height.

V15.5 never treats wallet submission as confirmation.

## Canonical inclusion / reorg check

A receipt is not accepted merely because the RPC returned it.

V15.5 fetches the block at `receipt.blockNumber` and requires its hash to equal `receipt.blockHash`.

A mismatch is classified as `REORGED` even if the old receipt remains available from the RPC.

## Confirmation semantics

Confirmation count is inclusive:

`latest - included + 1`

The configured minimum-confirmation policy applies only before safe/finalized promotion. Safe/finalized heads take precedence because they are stronger chain signals.

## Reverted transactions

A receipt with status `0x0` is `REVERTED`.

The receipt, block identity and gas fields remain available for diagnostics. V15.5 does not relabel a reverted transaction as successful because an API record exists.

## V13 reconciliation boundary

V13 remains authoritative for Exchange-indexed application activity and its canonical/reorg/replacement semantics.

V15.5 queries V13 history with `activeOnly:false` so both canonical and orphaned history remain visible.

The default reconciliation kinds are:

- TRADE
- FILL
- ORDER
- CANCELLATION
- BRIDGE_DEPOSIT
- BRIDGE_WITHDRAWAL
- FEE_ROUTING

Records are matched by canonical transaction hash.

Reconciliation outcomes are:

- `UNINDEXED` — no matching V13 records are currently visible;
- `CANONICAL` — at least one active V13 record matches;
- `REORGED` — matching records exist but are inactive/orphaned.

Replacement record IDs are preserved from `replacedBy`.

## Disagreement handling

RPC and V13 are independent evidence surfaces and neither is silently rewritten to agree with the other.

V15.5 explicitly reports conflicts such as:

- RPC says reorged while V13 still says canonical;
- RPC says included/confirmed/safe/finalized while V13 only exposes orphaned records;
- RPC receipt reverted but V13 exposes canonical success activity such as TRADE/FILL/BRIDGE activity.

A conflict marks reconciliation incomplete.

## Dropped vs replaced

A dropped transaction is not automatically called replaced.

V15.5 does not infer a replacement transaction hash from sender/nonce alone because the current V13/public RPC surfaces do not provide a canonical replacement-by-nonce lookup.

Replacement is reported only when canonical indexed evidence exposes a replacement record link or a later lifecycle phase receives explicit canonical replacement evidence.

## Safety boundary

V15.5 does not:

- resubmit dropped transactions;
- guess replacement hashes;
- synthesize V13 records;
- mark an unindexed transaction failed;
- claim finality from confirmation count alone;
- erase orphaned history;
- treat Explorer/UI data as protocol authority.

## Exit criteria

V15.5 is repository-complete when tests prove:

1. pending and dropped states are distinct;
2. successful receipts require canonical inclusion-block hash parity;
3. confirmation counts are deterministic;
4. safe/finalized head promotion is supported;
5. receipt status zero remains reverted;
6. reorged receipt blocks fail canonicality;
7. V13 history is queried with orphaned records retained;
8. canonical/reorg/replacement V13 state is preserved;
9. RPC/V13 conflicts are explicit;
10. unindexed state is not fabricated into a protocol outcome.

The next phase is **V15.6 — live/testnet swap execution qualification**.
