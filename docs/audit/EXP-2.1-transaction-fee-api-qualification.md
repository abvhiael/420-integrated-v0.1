# EXP-2.1 — authoritative transaction fee model and API qualification

## Objective

EXP-2.1 closes the repository service/API portion of `EXP-FIND-008`: 420Explorer must expose the actual native transaction fee rather than only `gasUsed`.

The canonical input is the execution receipt's `effectiveGasPrice`. 420Indexer converts that quantity to a base-10 integer string and derives:

`actualFeeWei = gasUsed × effectiveGasPriceWei`

The multiplication uses arbitrary-precision integers so large EVM quantities cannot overflow a JavaScript-safe integer or Go `uint64`.

## Implementation boundary

- `indexer/model/model.go` persists `effectiveGasPriceWei` and `actualFeeWei`.
- `indexer/rpc/eth.go` requires `eth_getTransactionReceipt.effectiveGasPrice`, converts it to decimal, and computes the actual fee.
- `explorer/service/transactionviews.go` exposes both fields and independently verifies that the supplied fee equals `gasUsed × effectiveGasPriceWei`; missing, malformed, negative or inconsistent fee provenance fails closed.
- Indexer and Explorer API tests prove serialization of both fee fields.

420Indexer and 420Explorer remain non-canonical derived read infrastructure. Fee authority remains the canonical execution receipt.

## Qualification gate

EXP-2.1 requires all of the following on the exact branch head:

1. known 21,000 gas × 1 gwei vector = 21,000,000,000,000 wei;
2. zero-fee edge case;
3. arithmetic above the `uint64` gas-price range without overflow;
4. missing/malformed effective-gas-price rejection;
5. Explorer rejection of inconsistent actual-fee data;
6. Indexer and Explorer API serialization checks;
7. full `go test ./indexer/... ./explorer/...` and `go vet ./indexer/... ./explorer/...`;
8. the retained 420Indexer qualification workflow, including all EXP-0 and EXP-1 gates;
9. the dedicated EXP-2.1 exact-head workflow and retained evidence artifact.

## Scope boundary

This milestone completes the repository model/service/API portion of `EXP-FIND-008`. The finding remains Genesis-blocking until EXP-4 renders gas used and actual fee distinctly in the deployed user workflow. Live target-network comparison remains EXP-7 work, and Genesis closeout remains EXP-8 work. No deployed-UI, live-network, or Genesis-readiness claim is made by EXP-2.1.
