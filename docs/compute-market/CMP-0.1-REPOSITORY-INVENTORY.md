# CMP-0.1 — Repository baseline and architecture inventory

Status: **IN PROGRESS — source-confirmed initial inventory, not a completed repository-wide audit**. Frozen inspection baseline `main` commit `277395931f5419af0728f3ea801800401a8bb336`; CMP branch `feature/cmp-0-protocol-specification`. Source links below point to the frozen inspection commit rather than mutable `main`.

## Authority and classification

The authoritative [frozen ComputeMarket V1 architecture](../420-COMPUTE-MARKET-V1-ARCHITECTURE.md) defines CMP-INV-001–030, distinct canonical identities and the implementation order. Its proposed `contracts/src/compute/` filenames are **proposals**, not evidence of deployable source. A direct GitHub Contents request for `contracts/src/compute/` on the inspected base returned 404. Searches for `ComputeProviderRegistry420` and `ComputeJobRegistry420` returned architecture and Genesis application map references rather than corresponding Solidity source on inspected `main`. This is **not** proof that no compute-related code exists elsewhere; source-wide inventory remains pending.

The frozen Genesis address reconciliation at this base is the PR #365 merge. CMP receives **no new frozen Genesis system address** by implication. ComputeMarket application addresses are registry-resolved only after deployment, code-hash verification and authorized publication; catalog candidates do not create live contracts. Do not use retired recovery work as implementation authority.

## Source-confirmed inventory

All GitHub source links below are pinned to the inspected base commit.

| Component | Exact source | Observed implementation and limitations | CMP disposition |
|---|---|---|---|
| Mature ComputeMarket architecture | [V1 architecture](../420-COMPUTE-MARKET-V1-ARCHITECTURE.md) | Frozen canonical object model, invariants and proposed modules; not proof of executable contracts | Normative specification; do not duplicate or silently revise |
| AI job facade | [AIJobManager.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/277395931f5419af0728f3ea801800401a8bb336/contracts/src/ai/AIJobManager.sol) | Solidity source defines AI job statuses, `computeRequestId`/`computeJobId`, a separately bound `computeAdapter` and hardcoded AI escrow `0x...0432`; not a general-purpose CMP registry | Preserve AI compatibility and define narrower AI-to-CMP adapter; verify full transitions before reuse |
| AI provider facade | [AIProviderRegistry.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/277395931f5419af0728f3ea801800401a8bb336/contracts/src/ai/AIProviderRegistry.sol) | Provider lifecycle, operator/settlement accounts, stake reference and `computeProviderRef`; not a compute node/resource/offer registry | Bind AI reference to canonical CMP provider identity; do not conflate IDs |
| AI escrow compatibility | [AIJobEscrow.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/277395931f5419af0728f3ea801800401a8bb336/contracts/src/ai/AIJobEscrow.sol) | Disables direct custody, binds Vault/settlement adapters, records payer/beneficiary and references; release checks beneficiary and refund targets payer. AI job-manager `0x...0431` is AI-specific. Deployed adapter operation not proven | Reuse non-redirectability rules; do not turn AI escrow into CMP custody |
| Vault read/authorization router | [VaultRouter420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/277395931f5419af0728f3ea801800401a8bb336/contracts/src/vault/VaultRouter420.sol) | Binds registry/accounting/authorization; exposes state and accounting reads and an authorization check, but no reserve/release API in inspected router | Inspect underlying funding, reserve, claim and refund primitives before adapter design |
| Vault family | [AssetVault420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/277395931f5419af0728f3ea801800401a8bb336/contracts/src/vault/AssetVault420.sol), [VaultFactory420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/277395931f5419af0728f3ea801800401a8bb336/contracts/src/vault/VaultFactory420.sol), [VaultRegistry420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/277395931f5419af0728f3ea801800401a8bb336/contracts/src/vault/VaultRegistry420.sol), [VaultAccounting420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/277395931f5419af0728f3ea801800401a8bb336/contracts/src/vault/VaultAccounting420.sol), [VaultAuthorization420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/277395931f5419af0728f3ea801800401a8bb336/contracts/src/vault/VaultAuthorization420.sol), [IVault420.sol](https://github.com/abvhiael/420-integrated-v0.1/blob/277395931f5419af0728f3ea801800401a8bb336/contracts/src/interfaces/IVault420.sol) | Named sources present in repository index/imports; complete reservation, reconciliation, escrow and refund semantics not yet verified | Inspect code, tests and deployment binding; identify one approved adapter and failure/solvency model |
| AI/compute documentation | [AI infrastructure](../architecture/infrastructure/420ai-compute-infrastructure.md), [AI/compute integration](../developers/ai-and-compute-integration.md) | Development docs distinguish AI request/model ownership from CMP resource/match/receipt/verification/settlement; anticipated workers/schedulers are not proof of executable code | Maintain separation and inspect service packages independently |
| Genesis inventory | [genesis-dapp-contract-map.json](https://github.com/abvhiael/420-integrated-v0.1/blob/277395931f5419af0728f3ea801800401a8bb336/contracts/config/genesis-dapp-contract-map.json) | Includes proposed CMP filenames, not evidence of deployed/verified/published contracts | Reconcile every registration/deployment reference with frozen post-PR-365 system map |

## Unresolved qualification gates

1. Enumerate every compute-related source, test, SDK, service, workflow, deployment and registry reference, including paths outside `contracts/src/compute/` and authorized linked repositories. Inspect source rather than interpreting search misses as absence.
2. Audit the actual Vault accounting, authorization, registry and asset-custody implementation, its reserve/claim/refund ABI, native-$420 accounting, test coverage and adapter binding. Trace AI Vault and settlement adapters to code or mark them missing/unwired.
3. Inspect complete AI job transitions, provider eligibility, compute adapter and corresponding tests; record compatibility requirements and deployment evidence.
4. Inventory ProtocolRegistry, capability registry, stake/slashing, Trust, verification, receipts, arbitration and deployment/configuration paths and check post-PR-365 address authority.
5. Inspect `fourtwentyd`, `node420`, worker daemons, schedulers, `@420/compute-sdk`, 420Compute frontend and tests. Classify each as implemented, tested, deployable, live or planned based on actual evidence.
6. Produce the ownership/reuse/missing-component matrix and minimal implementation sequence, with regression tests for any mechanical inventory or address checks added in this phase.
7. Run documentation, contract and full repository qualification on the final exact PR head and reconcile against latest `main` before considering closeout.

## Preliminary findings

- AI job and provider contracts expose AI-specific compatibility objects, not general-purpose CMP authority. CMP should bind through scoped adapters.
- The existing AI escrow establishes an adapter-bound, non-redirectable pattern, not a ready-to-use CMP funding path.
- `VaultRouter420` exposes reads/authorization checks; do not assume a job-specific funding API without inspecting lower-level Vault modules.
- A complete repository-wide claim about source absence, deployability or production status is not yet supported.

This initial inventory deliberately leaves its outstanding gates open rather than implying a completed audit.
