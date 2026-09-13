# Launchpad events

Consumers may index project, sale and allocation lifecycle events emitted by the canonical Launchpad contracts. Event-derived views are rebuildable projections and do not outrank canonical contract state.

Indexers should preserve block number/hash, transaction hash, log index, contract address and decoded event version so reorg/finality handling remains explicit.
