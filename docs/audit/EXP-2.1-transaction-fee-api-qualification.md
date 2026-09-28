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


## Candidate exact-head evidence

Candidate implementation head `f8dab6881a773d33c51137b96bf3d27359198cca` completed the full triggered qualification matrix successfully:

- 420Explorer EXP-2.1 — run 36365133547 — success
- 420Indexer — run 36365133620 — success
- 420 Integrated Qualification — run 36365133613 — success
- 420Docs Qualification — run 36365133602 — success
- EXP-1.6 Historical Producer Qualification — run 36365133537 — success
- EXP-1.7 Cross-Layer Traceability Qualification — run 36365133570 — success
- EXP-1.8 Runtime Negative Divergence Qualification — run 36365133514 — success
- EXP-1.9 CI Qualification Automation — run 36365133623 — success
- EXP-1.10 Phase Closeout Qualification — run 36365133670 — success

This candidate evidence proves the implementation and retained qualification gates. The evidence-recording commits themselves create a new branch head, so EXP-2.1 is not marked complete until those same retained gates re-run successfully on the final recording head.
