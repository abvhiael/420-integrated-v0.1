# RESOURCE-AUDIT-8A.1 reconciliation ledger
Baseline 7b442585f078277966411e9db9212366215952e9; historical qualification ab23f86e4662aab89bbee885e51aee6ab6dd0343.
The adjacent baseline JSON records 172 path/blob comparisons. All 19 Resource Solidity sources and direct Vault, Capability and Protocol Registry sources match. GovernanceTimelock changes retain legacy slots and introduce transient execution context; qualify Cancun execution and policy administration. Namespace adds AI/arbitration metadata; V3 predeploy changes founder and bridge initialization; preserve current canonical configuration. Foundry changes add tournament profiles and filesystem permissions; compare resolved compiler configuration. Runtime gateway/developer HTTP and arbitration evidence changes require integrated review, not presumed equivalent.
## Branch disposition
Exhausted cursors for resource, storage, 420store, relay, gateway, cache, feature/sr-. Ancestor branches (zero ahead): resource-phase-closeout-498-20261003, audit/exp-next-3-cross-resource-ui-20260928, audit/resource-protocol-remediation-20261002, docs/storage-resource-closeout, feature/sr-8.1-resource-runtime, feature/420indexer-idx7-direct-resources-v1, feature/420resource-protocol-genesis-v1, feature/420rpc-rpc6-resource-controls-v1, reconcile/resource-audit-498-20261003, fix/storage-proof-main-reconciliation, docs/420store-roadmap-sr43, feature/sr-3-420store-core, feature/sr-7.1-gateway-routing, feature/sr-6.1-cache-admission, feature/sr-6.2-cache-runtime, feature/sr-6.3-cache-persistence, feature/sr-6.4-cache-revalidation, feature/sr-6.5-cache-reconcile-service, feature/sr-6.6-cache-node420-runtime, feature/sr-6.7-cache-transport, feature/sr-6.8-cache-transport-hardening, feature/sr-4.3-closeout, feature/sr-4.3-proof-submitter, feature/sr-4.3-streaming-runtime, feature/sr-4.4-reconciliation, feature/sr-5-repair-planner, feature/sr-5.2-canonical-repair-reader, feature/sr-5.3-reconstruction, feature/sr-5.4-provider-selection, feature/sr-5.5-placement-repair-transition, feature/sr-5.6-repair-orchestration, feature/sr-5.7-rpc-repair-writer, feature/sr-5.8-repair-job-journal, feature/sr-9.1-developer-api, feature/sr-10.1-production-topology, audit/ai-audit-10-1-c-abi-storage, feature/bong-goggles-bg13-media-storage, hc-next-6-5-canonical-social-gateway.
Divergent feature/storage-proof-protocol-v1 (fafc814c9c4ceb361eb74df4087fa8c73b6878f5, one unique commit): two identical files (interface and authorization), formatting-only commitment/scheme registry changes, proof registry adds challenge lookup on main, IDs add agreement acceptance, test strengthens exact late revert and unconsumed challenge, configs extend storage graph. Retain main; no restoration identified. Divergent fix/sportsbook-marquee-odds-durable-cache-20261107: ten unique commits, nine files, none in Resource/Storage source/runtime/SDK scope.
## Remediation ledger
| ID | Owner | Requirement |
|---|---|---|
| RP-001 | 8A.3 | Current timelock integration |
| RP-002 | 8A.2 | Canonical collateral |
| RP-003 | 8A.3 | Capability scope |
| RP-004 | 8A.4 | Canonical session identity |
| RP-005 | 8A.4 | Authenticated metering |
| RP-006 | 8A.5 | Payment authority |
| RP-007 | 8A.6 | Canonical Vault identity |
| RP-008 | 8A.6 | Settlement accounting and reentrancy |
| RP-009 | 8A.7 | Production proof verification |
| RP-010 | 8A.8 | Capacity and agreement integration |
| RP-011 | 8A.9 | Runtime recovery and changed gateway/evidence access |
| RP-012 | 8A.10 | Ecosystem integration |
| RP-013 | 8A.11 | Shared-dependency CI |
| RP-014 | 8A.12 | Compiler reproducibility |
| RP-015 | 8A.12 | Deterministic release qualification |
All findings remain open pending their respective acceptance evidence. Source identity is not compiler qualification. No live or fresh test pass is claimed.
