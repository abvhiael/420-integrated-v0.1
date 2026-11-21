# LAUNCHPAD-REC-5 — ecosystem integration qualification

Status: **COMPLETE — local pre-testnet implementation and exact-head qualification**.
This is not a public testnet or production acceptance report. No merge was requested.

## Repository authority and exact-head evidence

- Authoritative repository: `abvhiael/420-integrated-v0.1`.
- Original `main` at execution start and verified base at closeout: `5496b09de8853f0978cb65a34e5d9f7493d1161f`, already containing merged LAUNCHPAD-REC-4.
- Working branch: `feature/launchpad-rec-5-ecosystem`.
- PR: [#1271](https://github.com/abvhiael/420-integrated-v0.1/pull/1271), **OPEN / NOT MERGED**, mergeable at closeout.
- **Exact executable qualification SHA:** `1531a8ada470a3f79e36ca9879502a4a39760ffc`.
- **Complete focused qualification:** [GitHub Actions run #44849506236](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44849506236), **SUCCESS** on that exact SHA:
  - Real local protocol deployment and settlement: **6/6 Foundry tests passed**, 0 failures or skips. Job `136677254217`.
  - Actual 420Wallet integration plus Launchpad browser service: **17/17 Node tests passed**, 0 failures. Canonical service/API and local indexer recovery: **5/5 Node tests passed**, 0 failures. Job `136677254192`.
  - Actual 420Reputation and 420Notifications Go consumer packages: **PASS**; actual 420Explorer raw-event view Go qualification: **PASS** in job `136677254192`.
  - Registry-attested shared 420Indexer: strict `npm ci` after repairing the existing package lock, TypeScript production compilation, **3/3 focused tests passed**, 0 failures. Job `136677253892`.
- Additional previous candidate evidence: [run #44849189433](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44849189433), **SUCCESS** before the final Wallet-specific test and protocol-specific diagnostics were added.
- The retained REC-4 and Audit-4/5 evidence is unaffected. This scope changed **no Genesis contract deployment configurations, Solidity production contracts, user permissions, issuance amounts, fee parameters, service IDs, or frozen addresses**.

## Cross-ecosystem implementation and exercised proofs

| Boundary | Actual implementation and qualification |
| --- | --- |
| **420Wallet** | Launchpad's EIP-1193 account/chain/review gates stay fail-closed; the real `wallet/web/core/genesis-wallet-integration420.js` service discovery verifies the canonical `420/service/launchpad/v1` ProtocolRegistry record, live runtime codehash, immutable destination and no implicit account/spending permission. Local Foundry participant calls use actual EOA caller context; a different Wallet cannot reuse a settled payment. |
| **420Pay** | Locally deployed real Merchant/Invoice/Payment/PaymentRouter/Settlement/Quote contracts and canonical Swap market, executor, adapter and constant-product pool. A valid registered campaign invoice receives a genuine converted token settlement, is marked `SETTLED` and closed, and is recorded exactly once as a Launchpad contribution. The conversion fixture uses an on-chain quote delivering **exactly** the campaign principal rather than merely meeting a minimum; no production economic rule was changed. |
| **420Identity** | Real Identity420 issuer, participant-owned profile and eligible credential. Profile is bound to the real Launchpad integration. Revoking the credential blocks creation of new payment intents after a prior valid contribution. |
| **420Registry** | Real ProtocolRegistry publishes the canonical Launchpad Router/service and component identities, validates codehashes and full constructor/reverse dependency graph. Inactive canonical Pay component registration fails closed, not silently substituted. No fixed Launchpad Genesis address is introduced. |
| **420Arbitration** | Real case/policy/ruling registries; sale-bound case origin and claimant, anti-replay dispute linking, finalized ruling publication and evidence events are exercised. A foreign-sale case cannot be linked to the campaign. |
| **420Reputation** | Real Launchpad contract `ReputationEvidencePublished` and delivery evidence are checked, decoded into the shared 420Indexer protocol projection via Registry/codehash-bound source verification. The existing Go contribution/delivery verifier rejects incorrect domain or non-final evidence. |
| **420Notifications** | Real Launchpad `NotificationPublished` contract logs are checked, decoded in 420Indexer, and consumed by the existing Go replay/checkpoint processor. Reorg/retraction signals are non-authoritative presentation updates; wrong-chain events cannot move the checkpoint. |
| **420Explorer** | Real Pay/Launchpad transaction event logs are matched at the contract emitter/topic boundary. The existing 420Explorer service preserves raw chain/block/tx/log provenance; a new Launchpad UI handoff opens only a verified HTTPS Explorer transaction route matching the Wallet chain, never implying settlement finality. |

## Shared 420Indexer boundary

- Added `420-indexer/src/launchpad-indexer.ts`: the indexer's real `ChainSource420` interface resolves `420/service/launchpad/v1` through ProtocolRegistry. It compares the published service, active version, router runtime codehash, genesis/chain identity, and the Router/Sale/Allocation/Project/Crowdfunding reverse dependency graph.
- All four event-emitting contracts use release ABI artifacts and individually verified runtime bytecode hashes. Required Launchpad event signatures (including contributions, allocation claims/refunds, disputes, Reputation, Notifications) must remain present in those artifacts; no wildcard or invented service address is accepted.
- Shared `ProtocolDecoderRegistry420` applies strict fixed-width event log validation, canonical block/transaction provenance, event emitter binding, uint/bool/address word constraints and fail-closed malformed-log handling.
- The production-style `createLaunchpadIndexer420` factory wires the existing durable SQL/checkpoint/reorg infrastructure and independently validates transaction receipt inclusion and the Registry graph again before ingestion. Event projections remain `authoritative:false`; the indexer never authorizes contributions or dispute remedies.
- Repaired the pre-existing `420-indexer/package-lock.json` discrepancy (missing `pg`, `@types/pg` and transitive dependencies) using npm's resolved package metadata. Strict clean `npm ci` and production TypeScript compilation pass.

## Boundaries and operations

- **Locally deployed real contracts:** Launchpad, ProtocolRegistry, Identity420, the 420Pay and Swap path, Arbitration, and CapabilityRegistry. Only shared Genesis environment safety, configuration and external authority primitives use existing controlled `GenesisMockEnvironment420` test doubles.
- **Real off-chain service implementation with deterministic fixtures:** 420Wallet verification, 420Reputation verifier, 420Notifications replay and 420Explorer read view. No public network or deployed standalone off-chain infrastructure was fabricated.
- A Live testnet (chain identity, contract addresses, deployment records, funded payment receipts and delivered notification side effects) is **not required for REC-5**, and is not claimed. The earlier production-equivalent `LAUNCHPAD-AUDIT-6` remains **BLOCKED — LIVE TESTNET REQUIRED**.
- The read-only Explorer link is unavailable while `explorerUrl` is unset; the default web runtime remains execution-disabled until canonical deployment configuration is resolved. The new 420Indexer factory does not silently activate a remote indexer without a verified chain, genesis block, Registry and artifact set.
- See [Launchpad deployment and operations](../apps/launchpad/deployment-operations.md) for local boundaries, chain / Registry configuration and incident recovery.
- **Next canonical step (not started):** `LAUNCHPAD-AUDIT-6 — production-equivalent testnet qualification`, contingent on an approved actual public testnet.
