# 420Launchpad — Creator studio and campaign governance (LAUNCHPAD-REC-3)

## What the creator can do

Launchpad's creator studio provides a five-step campaign wizard, canonical metadata and sale identifiers, a bounded signed governance-review request, lifecycle requests for already-owned sales, and owner-verified funding, fulfillment, refund, dispute and reputation reporting. **Neither a request receipt nor a prepared governance call approves a project, activates a sale or transfers funds.** Only the existing timelock/governance authority may register a project, create a sale, set a crowdfunding mode, activate, finalize or cancel it.

## Five-step submission

1. **Project:** public title, summary, description, HTTPS website, connected Wallet controller, sale-token address and explicit nonzero project issuance commitment.
2. **Type and entitlements:** choose exactly REWARD, DONATION, COMMUNITY_PROJECT or PRODUCT_PREORDER. Reward and preorder modes require one or more unique tiers with minimum raw-unit contribution and bounded quantity. Community projects require milestones. Product preorders require an identified product, shipping regions, fulfillment and cancellation terms, refund policy and estimated delivery date after the sale ends. Donation mode rejects reward tiers. All tier, inventory and fulfillment descriptions are **metadata commitments**, not new on-chain enforcement.
3. **Economics:** approved nonzero ERC-20 settlement asset, payout merchant, nonzero soft/hard caps, per-wallet cap, token allocation, and the sale-specific 420Identity eligibility policy. Amounts are integer token base units. Soft cap must not exceed hard cap, and per-wallet cap must not exceed hard cap. No equity/securities modes are exposed.
4. **Schedule:** start/end/claim timestamps; end must follow start and claims must not begin before end. Accept explicit registration risks.
5. **Canonical review:** the service normalizes the draft in a fixed JSON field order and derives its `metadataHash` via Ethereum Keccak-256 (`web3_sha3`). It calls the canonical project/sale registries' `canonicalId` functions, then constructs three exact governance-only calls: `registerProject`, `createSale`, and `setCampaignMode`. The request hash binds chain ID, current Launchpad Registry graph, requester, generated IDs, metadata commitment, mode and calls. Export the metadata + governance bundle to keep a durable public copy. Metadata must be available to governance reviewers and a suitable public content host; a hash alone is not hosted metadata.

## Signed request submission

The service accepts `POST /v1/launchpad/creator/prepare` for read-only review and `POST /v1/launchpad/creator/submit` for an explicit signed request. The browser requests a personal signature over the 32-byte request ID through Wallet. The server re-prepares the exact request from the submitted draft, compares request IDs, checks current network/contract-derived IDs, and verifies the Wallet signature. EOAs use the chain's ecrecover precompile with low-s checks; smart accounts use EIP-1271 `isValidSignature` against their contract code. The request is rejected on mismatch, malformed signature, duplicate ID or absent durable queue. The service **never** requires a seed phrase, holds signing keys, or makes privileged on-chain calls.

A successfully verified request is appended and fsynced to a local operator-owned JSONL ledger configured with `LAUNCHPAD_CREATOR_REQUEST_FILE`; its status is `RECEIVED_FOR_GOVERNANCE_REVIEW`. The queue is the intake boundary, **not** a governance proposal contract, automatic Timelock submission, or approval system. The operator must carry the reviewed canonical bundle into the actual governance process. Without queue configuration the submission API fails closed (HTTP 503); the draft/export flow remains available. Store the queue on persistent volume with restricted access, backup and monitoring. Do not treat an anonymous HTTP POST or browser-local state as authorization. A signed request should be considered a *public* proposal; redact personal or confidential content from description and terms.

The receipt listing endpoint returns limited public status metadata scoped to a requester address. It does not publish private signatures or expose the full request payload. Signature verification and queue de-duplication prevent tampering and replay.

## Existing campaign management

`GET /v1/launchpad/creator/campaigns/:account` discovers owned campaigns in the provenance-stamped projection, then independently checks the on-chain project controller and sale identity. It is discovery-only and can omit campaigns absent from the indexer; creators may enter a sale ID directly. `GET /v1/launchpad/creator/report/:account/:saleId` requires on-chain controller ownership; it reports the authoritative lifecycle state, active campaign mode, historical gross raised funding and on-chain refunded-principal reconciliation. Project and sale records, not a queue status, are the only canonical evidence of actual approval.

For an existing sale, `kind=LIFECYCLE` can prepare activate, finalize or cancel requests **only** if the connected Wallet matches the on-chain project controller and the transition is allowed by the current sale state. The request goes through the same signature and review queue as a new submission. Finalization still depends on actual time and goal checks in the governed sale contract.

## Contribution, fulfillment, refund, dispute and reputation reports

Canonical `SaleRegistry420.raised` is **historical gross funding**, not continuously current net funding. `reconciledSaleRefundPrincipal` exposes separately checkpointed delivered principal; it must not be interpreted as the total of all Pay refunds, available proceeds, or a grant to unwind a sale.

When configured, `LAUNCHPAD_CREATOR_REPORT_FROM_BLOCK` (decimal or `0x` format) enables a bounded canonical event report over the configured block range to the chain head: `ContributionRecorded`, `AllocationClaimed`, `RefundRecorded`, `DeliveryEvidenceBound`, `DeliveryAttested`, `DisputeLinked`, `DisputeOutcomePublished`, and `ReputationEvidencePublished`. The service validates event signatures, sale-ID indexing, source addresses, block/transaction hashes, ABI data size, duplicate logs and head continuity; scans at most 100,000 blocks per request in 2,000-block slices. It aggregates event counts and, where present, token-base-unit amounts, but **never** invents absent participants, payouts or physical delivery proof. Only a scan starting at genesis block 0 is labeled complete-from-genesis; all other scans are explicitly partial. If the start block isn't configured, the app shows authoritative ledger totals and reports event coverage as unavailable instead of manufacturing all-time metrics. Configure the correct deployment start block, or use additional verified indexing for very large histories. On reorg or unavailable history the report fails closed.

Reputation and dispute events are evidence, not authorization or universally reliable social scoring. Arbitration rulings do not move funds or cancel campaigns. Creator delivery claims are protocol attestations, not independent proof of shipment.

## Deployment, testing, and separation from testnet

The existing `launchpad/web` static build uses the configured runtime API. The backend needs real canonical Launchpad RPC/Registry binding, `LAUNCHPAD_CREATOR_REQUEST_FILE` persistent storage for signed request intake, and `LAUNCHPAD_CREATOR_REPORT_FROM_BLOCK` for optional historical event scans. Unit and browser tests cover the local API/contract boundaries without requiring a public testnet. This is not evidence of actual live governance decisions, funded contributions or production hosting.

For end-user payment, Identity and claim details, see [Consumer guide](user-guide.md). See also [Launchpad security](security.md) and [Deployment and operations](deployment-operations.md).
