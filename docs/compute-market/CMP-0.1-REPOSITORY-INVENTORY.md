# CMP-0.1 — Repository baseline and architecture inventory

Status: **SOURCE INVENTORY AND INTEGRATION BOUNDARY ASSESSMENT COMPLETE for the pinned repository snapshot; ComputeMarket implementation, live deployment and end-to-end integration NOT complete.** Baseline: `main` `277395931f5419af0728f3ea801800401a8bb336`; CMP PR branch `feature/cmp-0-protocol-specification`.

The complete source, test, authority, custody and adjacent-service matrix, exact pinned GitHub source references, integration findings, missing implementation classifications and subsequent gates are recorded in the [CMP-0.1 source and integration audit](CMP-0.1-SOURCE-AND-INTEGRATION-AUDIT.md). This inventory entry is the phase index; the linked audit supersedes its earlier preliminary and unresolved-inventory wording.

## Verified source-level findings

The [frozen ComputeMarket V1 architecture](../420-COMPUTE-MARKET-V1-ARCHITECTURE.md) governs provider-neutral off-chain compute and its 30 invariants. Its proposed `contracts/src/compute/` modules are catalog entries; inspected named compute contract paths are missing on the pinned baseline, whereas existing AI, Vault, Resource, Trust and arbitration source is present. No conclusion is made about uninspected external repositories or future branches.

- AI provider, job, escrow and reputation contracts expose compatibility state and adapter hooks, but their unit tests mock Compute/Vault/Trust counterparties. The named `AIComputeAdapter420.sol` is not present at the audited path; no real funded AI-to-CMP adapter path has been certified.
- `AssetVault420` and `VaultAccounting420` **do implement** native funding, reserved obligations, release, claim and cancellation. `VaultRouter420` is read-only, not the custody write interface. Vault accounting only accepts calls from its registered Vault, and mutations require scoped permissions and unique operation IDs. The existing isolated Vault tests do not demonstrate CMP partial provider entitlement or payer-bound refund.
- Resource Protocol already has provider/node/offer/session/usage-receipt components, but their service session model is not CMP canonical match/job/manifest/verification or the basis for CMP settlement authority.
- `CapabilityRegistry420` supplies scoped action authority; `ProtocolRegistry` supplies verified versioned discovery, not execution/custody authority. Trust and arbitration require explicitly bounded CMP integration; none of these services can be silently repurposed into a privileged matcher.
- The [frozen address reconciliation](../GENESIS-ADDRESS-AUTHORITY-MAIN-RECONCILIATION.md) preserves fixed AI `0x042f–0x0433`, registry `0x0434`, and consensus gateway `0x043c`. CMP receives no new fixed Genesis predeploy by implication.
- The inspected `node420` CLI is an execution/Geth wrapper with optional storage/cache/gateway facilities; no compute provider flag is declared there. The inspected `packages/` directory contains no separate `420-compute-sdk` package. CMP worker, independent matcher, frontend, CMP deployment and on-chain publication remain **not operationally verified** by this audit.

## Closeout boundary and qualification

The **inventory** is resolved by classifying reused code, missing CMP implementation, tests, authority and exact integration prerequisites in the linked audit. **Runtime integration is not falsely marked passed:** no audited source establishes a signed worker receipt, policy-verification decision and split Vault settlement/refund against a real canonical ComputeJob. Those are design/implementation and negative-test gates for the subsequent CMP stages, not an inventory ambiguity. The previous PR head `8d140dfb7b08be0b23f1debefae68c12693f1e7f` passed Docs #2597 and Integrated #5209, but that evidence does not qualify later commits or new CMP end-to-end tests. Re-run applicable checks on the final exact PR head. Keep PR #367 draft while CMP-0 specification and implementation qualification gates remain open.
