# 420 Launchpad deployment and Registry publication

`LAUNCHPAD-AUDIT-4` freezes the repository-side release materialization for the Launchpad protocol and its crowdfunding integration. It does not claim a live public-testnet deployment.

## Address policy

- `LaunchpadRouter420` remains `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`.
- No new Genesis predeploy is introduced.
- No CREATE2 policy is invented.
- Historical candidate `0x000000000000000000000000000000000000045c` is superseded and must not be used as an active address.
- Canonical discovery is through `ProtocolRegistry` at the frozen Registry authority once a governed live deployment exists.

## Repository deployment sequence

1. deploy `LaunchpadAuthorization420(CapabilityRegistry420)`;
2. deploy `LaunchpadProjectRegistry420(GovernanceTimelock)`;
3. deploy `LaunchpadSaleRegistry420(GovernanceTimelock, LaunchpadProjectRegistry420)`;
4. deploy `LaunchpadAllocationRegistry420(LaunchpadAuthorization420, LaunchpadSaleRegistry420)`;
5. execute one-time `LaunchpadSaleRegistry420.setController(LaunchpadAllocationRegistry420)`;
6. deploy `LaunchpadCrowdfundingIntegration420(LaunchpadAllocationRegistry420, PaymentRegistry420, Identity420, ArbitrationCaseRegistry420, ArbitrationRulingRegistry420)`;
7. execute one-time `LaunchpadAllocationRegistry420.setCrowdfundingIntegration(LaunchpadCrowdfundingIntegration420)`;
8. deploy `LaunchpadRouter420(LaunchpadSaleRegistry420, LaunchpadAllocationRegistry420)`;
9. register the canonical `420/COMPONENT/LAUNCHPAD/V1` component to the exact router in ProtocolRegistry;
10. publish `420/service/launchpad/v1` with `publishRegisteredService`.

## Identity and verification

The exact build uses Solidity 0.8.24, Cancun EVM, optimizer 200 runs and via-IR. Qualification retains compiled artifact SHA-256, canonical ABI SHA-256, runtime-template SHA-256, local deployed EXTCODEHASH values, the Registry dependency root, manifest commitment and interface commitment.

The local deployment test proves the exact constructor graph, both one-shot post-initialization bindings, router smoke reads, ProtocolRegistry active service/component resolution and wrong-router visibility.

## Live boundary

Local Foundry addresses and runtime identities are repository qualification evidence only. Public-testnet chain identity, deployed addresses, deployment transactions, Registry publication transactions, live code hashes and constructor-binding receipts are owned by `LAUNCHPAD-AUDIT-6` and remain unset until that live step.

## Creator review queue and reporting (REC-3)

Configure `LAUNCHPAD_CREATOR_REQUEST_FILE` as an application-writable, persistent, restricted-permission JSONL ledger before accepting signed governance-review requests. Without it submissions fail closed. The service checks personal/EIP-1271 signatures against the canonical chain, reconstructs project/sale calldata and stores review receipts; no backend signing or automatic governance execution occurs. Optionally set `LAUNCHPAD_CREATOR_REPORT_FROM_BLOCK` to an exact deployment start block for bounded historical event scans; otherwise event totals are intentionally unavailable. Back up the review ledger and monitor its capacity; on-chain project status remains authoritative. See [Creator guide](creator-guide.md).

## Wallet, API and indexer hardening (REC-4)

The browser disables direct submissions without the connected account and chain ID, a reviewed exact selector, argument and target match, zero native value and current Registry-derived contract identities. Reviews expire after two minutes and are invalidated on changed input, account or network; just before Wallet approval the client requests a fresh exact transaction review, Registry graph and canonical sale position. Contract identity cannot be overridden by a service response that differs from an explicitly configured canonical runtime.

The service must use `LAUNCHPAD_RPC_URL` (HTTPS, or localhost HTTP for local development), `LAUNCHPAD_CHAIN_ID` and an absolute `LAUNCHPAD_PROJECTION_FILE`. Set `LAUNCHPAD_CORS_ORIGIN` to the exact HTTPS origin of the browser frontend even when it shares a hostname with the API; ordinary browser POSTs carry an `Origin` header. If unset, the API accepts only requests without an `Origin` header, such as trusted server-side local checks. The server enforces bounded JSON bodies, rate and concurrency limits, short RPC timeouts and rejects malformed JSON-RPC envelopes. No backend key custody, transaction signing or remote wallet broadcast exists.

**Indexer reconstruction (local, testnet not required):** Set `LAUNCHPAD_INDEX_FROM_BLOCK` to the exact deployment block (hex quantity) and run `npm --prefix launchpad/service run rebuild` in the repository checkout. The command scans bounded canonical `SaleCreated` events from the Registry-attested sale contract, checks each log's block-hash inclusion and sale/project/mode binding, and atomically replaces the projection file. It does not trust previously indexed entries: a reorg or restart reconstructs from chain history, dropping orphaned sales. The indexed snapshot includes chain ID, block height/hash, Registry-derived contract IDs and a maximum freshness window of 64 blocks; stale, malformed, orphaned or mismatched snapshots return an error rather than a campaign catalogue. Rebuild again from the deployment block following a reorg, missing/corrupt snapshot or prolonged downtime.

This local-only discovery index intentionally uses neutral on-chain-derived titles and generic summaries. Any editorial metadata must be validated independently before presentation; never substitute off-chain titles for canonical sale identities or outcomes. RPCs must provide `eth_getLogs`, canonical `eth_getBlockByNumber` results, contract reads, `eth_getCode` and `web3_sha3`. A bounded historical scan older than the configured maximum range must be split/rebuilt under an explicitly reviewed operational policy, not bypassed silently.
