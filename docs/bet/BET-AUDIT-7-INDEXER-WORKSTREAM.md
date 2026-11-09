# BET-AUDIT-7 / 420Indexer event workstream — operator contract

**Status: repository-side adapter implemented; live service acceptance remains open.**
This workstream is separate from 420Wallet, Registry, Notifications, Mail, Search and Analytics deliverables.

## Source of truth and security boundaries

- Input: real 420Indexer **API v1** `GET /v1/status`, `GET /v1/blocks/:number`, `GET /v1/logs` (address-filtered, ascending, cursor-paged) and `GET /v1/transactions/:hash/receipt`, as defined in `docs/420INDEXER-API-V1.md`, `420-indexer/src/receipt-log-dto.ts` and `420-indexer/src/public-dto.ts`.
- Event source: **actual** contract ABI event signatures in `contracts/src/bet/WagerRouter420.sol`, `SettlementEngine420.sol`, `PokerSeatLedger420.sol`, `PokerCanonicalSettlement420.sol`, `fantasy/FantasyContestEngine420.sol` and `sports/SportsFundedTickets420.sol`. The adapter computes Ethereum Keccak-256 topic0 and validates indexed parameter counts and ABI data lengths, rather than treating contract logs as generic transaction confirmations.
- Full required roles: `casino-router`, `casino-settlement`, `poker-ledger`, `fantasy-contest`, `sports-tickets`; optional `poker-canonical`. One contract address is bound to one role, and each binding has a unique ID and deployment start block. For shared casino routers/settlement, wager IDs and acceptance `gameVersionId` are retained; **do not** attribute settlement to a particular slot/Dice/etc. without independently joining a proven acceptance and approved game-version manifest.
- Every recognized log is checked against configured chain ID and emitting contract address, matching receipt transaction hash/block number/block hash/transaction index with successful receipt status, matching canonical indexed block hash, and a consecutive parent-hash chain in the scanned range.
- The adapter is **read-only** and writes no wagers, payouts, balances or eligibility. Indexer is a non-authoritative rebuildable projection; these checks provide **internal consistency** of Indexer data, not independent on-chain consensus or proof of a production deployment. Genuine official network credentials, independently verified deployment manifests and runtime code hashes are separately required before a production-equivalent acceptance claim.

## Launch and checkpointing

Run from `clients/420bet-lobby` in a trusted backend environment, not in a browser:

```sh
BET_INDEXER_EVENT_MANIFEST=/secure/bet-indexer-events.json \
BET_INDEXER_EVENT_CHECKPOINT=/durable/420bet/indexer-events.json \
npm run sync:indexer:events
```

Example schema only; these are **deliberately invalid placeholders** and must be replaced by verified addresses, chain ID and a genuine HTTPS endpoint before execution:

```json
{
  "chainId": "REPLACE_WITH_OFFICIAL_CHAIN_ID",
  "indexerUrl": "https://REPLACE_WITH_TRUSTED_INDEXER/",
  "contracts": [
    {"id":"casino-router-v1","role":"casino-router","address":"REPLACE_WITH_VERIFIED_ADDRESS","fromBlock":"REPLACE_WITH_DEPLOYMENT_HEIGHT"},
    {"id":"casino-settle-v1","role":"casino-settlement","address":"REPLACE_WITH_VERIFIED_ADDRESS","fromBlock":"REPLACE_WITH_DEPLOYMENT_HEIGHT"},
    {"id":"poker-ledger-v1","role":"poker-ledger","address":"REPLACE_WITH_VERIFIED_ADDRESS","fromBlock":"REPLACE_WITH_DEPLOYMENT_HEIGHT"},
    {"id":"fantasy-contest-v1","role":"fantasy-contest","address":"REPLACE_WITH_VERIFIED_ADDRESS","fromBlock":"REPLACE_WITH_DEPLOYMENT_HEIGHT"},
    {"id":"sports-tickets-v1","role":"sports-tickets","address":"REPLACE_WITH_VERIFIED_ADDRESS","fromBlock":"REPLACE_WITH_DEPLOYMENT_HEIGHT"}
  ]
}
```

`BET_INDEXER_EVENT_BATCH` is optional (1–64 blocks, default 64). Schedule repeated invocations until `complete: true`. Re-run thereafter as new safe blocks arrive. The manifest pins the service endpoint, chain ID, contract role, address and per-contract deployment block; its digest is recorded in the checkpoint. **Never change a manifest under an existing checkpoint**: the adapter fails closed. Use a new checkpoint after approved migration or a documented full rebuild.

State is written to a private persistent JSON checkpoint using a restricted file, fsync, atomic rename and single-worker lock; a concurrent sync fails rather than racing. The operator must provide durable filesystem storage, backups, filesystem permissions, process supervision, and monitor stalled retries, storage exhaustion and leftover locks after crashes. Stateless Cloudflare Workers storage or a Vite public asset directory is **not** suitable as this checkpoint location.

## Reorganization and failure recovery

1. Each sync checks that the previously committed safe-tip block still has the same canonical hash. If head retreats or tip differs, the adapter discards the entire old projection and every cursor and automatically rebuilds from the configured deployment start height. This deliberately prioritizes safety over incremental rollback optimization.
2. The new range verifies each consecutive parent hash; all recognized logs must be in that range and match receipts/blocks. Pagination is cursor-opaque and scans the contract's 420Indexer logs as supplied; a repeatable partial page is allowed at a safe-head boundary, with deduplication.
3. Before storing any range, the adapter queries status and the range-tip block again. A changed chain or unsafe finality aborts without advancing the checkpoint. It requires `confirmations` or `finalized` finality, not `head` mode.
4. Corrupted checkpoints, unsupported event encodings, forged receipt identities, unavailable APIs, stale runtime, page loops, invalid source configuration or missing required family bindings fail closed. A failed poll does not write a partially advanced checkpoint.
5. The checkpoint is an **internal projection**, not a settlement ledger. If a future notification, search or analytics consumer is added, it must rebuild or receive explicit invalidation on reorg. Do not publish this file publicly.

**Scaling limitation:** The current API has no `fromBlock` query filter for logs. First sync and deep reorg rebuilding may scan historical address-filtered pages, and a full rebuild can be expensive on highly active deployments. Bounded page limits (5000 per contract per poll) and a maximum event retention (200,000) fail closed rather than silently omitting data. A production-scale migration to paged historical source ranges and a database-backed projection must retain the same cryptographic/receipt/reorg safety checks.

## Qualification and unresolved live proof

The branch's focused `420bet-ecosystem-7-level1.yml` tests cover Keccak topics, indexed and ABI validation, all engine families, receipt provenance, persistence/restart, tail pagination, reorg invalidation/rebuild, finality denial, malformed bindings and poisoning.

A local fixture using **the real API response schema** verifies the adapter, but it is not a real running 420Indexer deployment, proof that the source has indexed genuine funded transactions, a signed deployment manifest, or third-party approval. To close official-network acceptance later, supply verified service URL/certificate, chain ID, real deployed contract addresses and runtime hashes, independently approved manifest digest, actual event/receipt/block samples with source identifiers, reorg and outage drills, a persistent storage deployment and exact-SHA CI/operational evidence. No production betting is authorized by this adapter.
