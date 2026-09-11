# 420Indexer testnet qualification

IDX-10 qualifies the hardened 420Indexer against the 420 Integrated testnet without changing the indexer's authority boundary. Indexed state remains a rebuildable off-chain projection of canonical chain history.

## Qualification sequence

1. **IDX-10.1 — environment and harness contract — implemented**
   - pin chain ID and genesis hash
   - pin RPC endpoint and finality mode
   - define sustained-chain-activity target
   - define bounded reorg and restart-replay windows
   - fail closed on missing, malformed or internally inconsistent configuration
2. **IDX-10.2 — live RPC ingest/indexing smoke — harness implemented; live deployment evidence pending**
   - verify `eth_chainId` and genesis block identity before ingest
   - observe source head and derive the safe head from the configured finality policy
   - require the full configured sustained safe-block window to exist
   - ingest the exact sustained window through the production `IndexerIngestor420` path
   - ingest canonical blocks, transactions, receipts and logs through the selected `ChainSource420`
   - require exact block-count completion and checkpoint advancement through the observed safe head
   - fail closed on chain/genesis mismatch, insufficient safe history, unsupported finalized semantics or unexpected qualification-window movement
3. **IDX-10.3 — restart, replay and reorg qualification — implemented**
   - require an existing durable checkpoint/history state before restart qualification
   - fail closed when checkpoint catch-up exceeds `IDX420_RESTART_REPLAY_BLOCKS`
   - resume through the production ingestor and require checkpoint advancement through the observed safe head
   - repeat at the same safe head and require zero additional processing to prove restart idempotence
   - exercise bounded canonical reorg ancestor recovery through the durable rollback path
   - replay the replacement canonical branch and require the checkpoint to return to the observed safe head
   - prove a reorg deeper than `IDX420_MAX_REORG_DEPTH` fails before rollback, checkpoint movement or projected-state mutation
4. **IDX-10.4 — consumer/API qualification — next**
   - qualify health/readiness/status against live indexed state
   - exercise public v1 block, transaction, receipt, log, address, asset and protocol-object surfaces
   - exercise notification replay/canonicality semantics against testnet-indexed events
5. **IDX-10.5 — readiness report and closeout**
   - record exact node/indexer revisions and qualification environment
   - record sustained-block window and observed failures/recoveries
   - close deployment-time ABI/descriptor qualification against compiled genesis artifacts
   - publish operator go/no-go checklist

## Environment contract

The harness consumes these explicit settings:

| Variable | Requirement |
| --- | --- |
| `IDX420_CHAIN_ID` | positive base-10 chain ID |
| `IDX420_RPC_URL` | absolute HTTP(S) JSON-RPC URL; credentials must not be embedded |
| `IDX420_EXPECTED_GENESIS_HASH` | 32-byte `0x`-prefixed genesis block hash |
| `IDX420_FINALITY_MODE` | `head`, `confirmations`, or `finalized` |
| `IDX420_CONFIRMATIONS` | positive integer only when finality mode is `confirmations` |
| `IDX420_SUSTAINED_BLOCKS` | positive number of safe blocks to index during smoke qualification |
| `IDX420_MAX_REORG_DEPTH` | positive bounded canonical reorg depth |
| `IDX420_RESTART_REPLAY_BLOCKS` | non-negative replay window; must not exceed max reorg depth |

The parser is intentionally fail closed. Testnet qualification must never silently fall back to a different chain, endpoint, finality policy, or recovery window.

## IDX-10.2 smoke semantics

`runTestnetSmokeQualification420` is deliberately built on the existing production indexing path rather than a parallel test-only importer. The caller provides the selected `ChainSource420` and `BlockConsumer420`; for a live testnet run the source should be `EvmJsonRpcSource420` backed by the configured HTTP JSON-RPC endpoint and the consumer should be the same projection consumer selected for the deployment candidate.

Before any projection write, the qualifier checks the configured chain ID and canonical genesis hash. It then derives a safe head under `head`, `confirmations`, or `finalized` finality, selects the exact trailing `IDX420_SUSTAINED_BLOCKS` window, and asks `IndexerIngestor420` to process that window. Qualification fails unless every block in that window is processed and the resulting checkpoint reaches the originally observed safe head.

A passing unit/CI harness proves the qualification logic and hostile-state behavior. It does **not** substitute for live testnet evidence. The live run must still be executed against the deployed testnet RPC endpoint and its resulting evidence retained for IDX-10.5 closeout.

## IDX-10.3 recovery semantics

`runTestnetRestartQualification420` consumes the deployment candidate's checkpoint and canonical-history stores instead of creating replacement state. It verifies the selected chain/genesis identity, derives the configured safe head and measures the catch-up gap from the stored checkpoint. A gap larger than `IDX420_RESTART_REPLAY_BLOCKS` fails closed before ingest. An allowed gap is processed by `IndexerIngestor420`, after which a second run against the unchanged safe head must process zero blocks and preserve the same checkpoint.

`runTestnetReorgQualification420` also uses the production ingestor and configured durable recovery stores. The existing reorg engine remains the only recovery authority inside the indexer: it locates the nearest retained canonical ancestor, invokes the consumer's durable rollback when available, truncates superseded local history through that durable transaction, and replays the canonical replacement branch. Qualification requires a positive recovered depth and a final checkpoint at the observed safe head.

The hostile deep-reorg case is part of the qualification contract. If the canonical divergence exceeds `IDX420_MAX_REORG_DEPTH`, recovery must throw before invoking rollback. Regression coverage snapshots checkpoint and projected-state evidence and requires both to remain unchanged after that failure.

## Evidence required for closeout

A completed IDX-10 qualification should retain:

- exact 420Indexer Git SHA;
- exact node/client Git SHA or release identifier;
- chain ID and genesis hash;
- finality configuration;
- qualification start/end block numbers;
- checkpoint before/after restart and measured replay gap;
- repeated-restart idempotence result;
- bounded reorg ancestor/depth and replay result;
- deep-reorg fail-closed/no-mutation result;
- API/consumer smoke results;
- any injected or observed failures and recovery result;
- final operator go/no-go decision.

Secrets, RPC credentials, notification payloads and private subscription data must never be committed to the report or repository.
