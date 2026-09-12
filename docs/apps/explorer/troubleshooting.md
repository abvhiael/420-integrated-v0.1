# Explorer troubleshooting

## Transaction missing
Confirm the transaction hash and network. A newly submitted transaction may not yet be included or indexed. Check Wallet/RPC state and the Explorer indexed height.

## Data looks stale
Compare head, safe and finalized heights. A lagging Indexer should be treated as degraded until it catches up.

## Label disagrees with address
Trust the canonical address and Registry/protocol record, not the presentation label.

## Recent record disappeared
A pre-finality reorg may have replaced the block. Re-check the canonical transaction/receipt state.

## Wrong-chain warning
Stop using the view for decisions and switch to the qualified 420 Integrated endpoint.

Safe support information includes public hashes, addresses, block numbers, app version and displayed indexer status.
