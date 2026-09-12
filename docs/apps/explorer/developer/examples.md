# Explorer integration examples

## Safe transaction lookup
1. Discover the qualified Indexer API endpoint.
2. Validate chain ID/network profile.
3. Fetch the transaction projection.
4. Read its block/receipt provenance and finality metadata.
5. If a decision requires settlement certainty, require the appropriate safe/finalized boundary.

## Safe contract display
Render the raw address first, then optional Registry/Names/Verify enrichment. Never replace the underlying address or bytecode identity with a label.

## Reorg-safe activity feed
Store canonical identifiers plus observed finality status; update or remove pre-finality items when the Indexer reports repaired canonical history.
