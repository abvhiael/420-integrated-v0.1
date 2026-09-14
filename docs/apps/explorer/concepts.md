# Explorer concepts

## Canonical vs derived
Consensus/execution defines canonical blocks and EVM state. Canonical protocols own their domain state. 420Indexer creates deterministic rebuildable projections. Explorer renders those projections.

## Provenance
Every meaningful indexed record should remain traceable to chain ID and an originating block, transaction, receipt, log or registered protocol object.

## Finality
Explorer must preserve head/safe/finalized distinctions instead of flattening every indexed observation into 'confirmed'.

## Reorgs
Pre-finality chain history may reorganize. 420Indexer repairs derived projections; Explorer should reflect repaired state and avoid presenting orphaned observations as canonical.

## Enrichment
Names, Identity, Registry and Verify data may improve readability but must not replace raw addresses, bytecode, transaction identity or canonical protocol state.
