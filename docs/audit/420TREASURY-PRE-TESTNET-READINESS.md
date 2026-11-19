# 420Treasury — authoritative pre-testnet readiness (TREASURY-REC-10)

**Scope: repository/local EVM; not a public-testnet or external-audit acceptance.** Baseline main `4ff153405aff4cd21a049e61e66adbbbd10541e3` (PR #1232 merged). This record supersedes stale historical readiness labels, not historical execution outcomes. REC-10 closure is contingent on the exact candidate closeout gate.

## Reconciliation ledger

| Step | Original qualifying SHA / run | Scope and result |
|---|---|---|
| REC-1 | `7e6956898b811b13613d13f551f3d04250e2ac0d` | [Baseline](420TREASURY-REC-1-BASELINE.md); 90 scoped paths, R01–R10 and E01; repository inspection only |
| REC-2 | `45d8b4d0eecb8049229d79b6633d227273a2b9a6`, [44571486048](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44571486048) | 24/24; router current asset-wide epoch cap |
| REC-3 | `e649d3a5b0dcae0aa0859750fe5a8808c5a9ed03`, [44574638401](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44574638401) | 48/48; native/token, real Vault binding |
| REC-4 | `6c627ce4ebb1bb9dcb384a388124687bc50a077e`, [44580443875](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44580443875) | 9/9 including parent; atomic executor and receipt recovery |
| REC-5 | `4c8e448de67122d6c45f703c86075f6ec6ae664b`, [44583083947](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44583083947) | 62/62 real governance/capability/Stake safety; static findings subsequently reconciled by REC-9 |
| REC-6 | `c1507c3f8885246843da51a930468ec354eff22b`, [44590461793](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44590461793) | 63/63, Grants/HighCountry/Town, Wallet and SDK |
| REC-7 | `cf0b38f38d337de9f5009ff63e0e7c8f4c5ecb8e`, [44597319428](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44597319428); `3d655c47a674bf4e2e1fadaf19973c6129deea24`, [44610899469](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44610899469) | 31 TypeScript + 1 SDK; 307 Go top-level (354 including subtests), race, vet, 15 mappings |
| REC-8 | `70895129b186e98d98e3aa5bb4b02f4d139750a2`, [44614034940](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44614034940); final `639d72f129952e05d2acac2f723eef81489dd30f`, [44614506921](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44614506921) | 6/6 including parent, byte-identical release builds and 12 actual local deployments; final 48/48 Vault and 9/9 executor regressions |
| REC-9 | `282e2cf6d9f4cde8c3b3b7a027724de1e0d0a63c`, [44618114810](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44618114810); final `82f4221e1461a06f36db7596494c25027a11052b`, [44619508029](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44619508029), [44619508030](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44619508030), [44619508070](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44619508070) | 6/6 Foundry, 50,000 fuzz cases, 524,288 invariant calls, zero reverts; 63 individual static dispositions (two distinct high warnings across scopes), zero unresolved in reviewed scope; executor 9/9. Initial static gate failed and remains historical; exact retained review passed. |

All original success runs above were checked through GitHub run status, with exact source identity retained. Counts overlap and must not be summed as unique tests. See the linked [canonical remediation roadmap](420TREASURY-AUDIT-REMEDIATION-ROADMAP.md) for original evidence and failure history. REC-1 R01–R09 are resolved by the indicated REC owners; R10 is this closeout. E01 remains external review, not local implementation. No independent auditor's approval is represented.

## Canonical inventory and trust

| Component | Local disposition |
|---|---|
| TreasuryAuthorization420 | Exact scoped CapabilityRegistry authorization |
| TreasuryPolicyRegistry420 | Governed explicit native/token allowlist and caps; immutable epoch duration |
| TreasuryBudgetRegistry420 | One-time controller; exact governed budget; executed <= committed <= ceiling |
| TreasuryDisbursementRegistry420 | Canonical tuple, windows, replay, policy, epoch accounting and exact scoped terminal writes |
| TreasuryRouter420 | Read-only current eligibility, including asset-wide remaining epoch capacity |
| TreasuryReleaseExecutor420 | Designated noncustodial release candidate; independently granted Treasury and Vault routes, reviewed commitment, atomic rollback |
| TreasuryIds420 / TreasuryVaultBinding420 | Internal libraries; canonical domains and verified Vault graph; no separate deployment |
| Shared interfaces/dependencies | I420System, SystemAccess, CapabilityRegistry, active ProtocolRegistry, Civic/Timelock, Vault registry/accounting/authorization and VaultRouter; their import closure is source-bound |

Five principal deployables plus executor; two internal libraries. No new fixed address, service ID, CREATE2 policy or Treasury custody path. The approved `AUTHORIZED_EXECUTOR_COMMITMENT_ONLY` model remains: an authorized direct caller can record a nonzero commitment without proving transfer. Vault custody and receipt correlation remain distinct. Local Treasury code, Wallet/SDK, Indexer/Explorer/Analytics and deployment tooling have no identified unimplemented production stub in the reviewed scope. Actual network identity, CapabilityRegistry materialization, executor operator and pins, grants and deployment addresses/receipts remain intentionally unpopulated. These are deployment inputs, not executable stubs; fail-closed behavior is retained.

## Release and integrations

The REC-8 [release rehearsal](420TREASURY-REC-8-REHEARSAL.json) retains local chain 31337 receipts and runtime hashes for two revisions. The production release remains Registry-resolved, built from the canonical exact source closure and frozen GovernanceTimelock / ProtocolRegistry artifacts (0x0429 / 0x0434); CapabilityRegistry candidate 0x0447 is not a deployed or frozen identity. The release bundle can be reproduced with the existing materializer. REC-10 changes only repository readiness metadata (not the canonical deployment payload), operator/API/SDK guidance, stale roadmap wording and evidence validation.

Wallet/SDK use chain-pinned Registry and component discovery and governed Civic review, capability-scoped simulation/confirmation; Grants uses the bound disbursement tuple and commitment-only completion; Town/HighCountry retain reference/permission boundaries. The actual Go Indexer, Explorer and Analytics are non-authoritative, fail closed on missing binding, and use canonical checkpoint/replay/reorg handling. Known operational and recovery boundaries remain in [operator guide](../apps/treasury/operator-guide.md), [API and SDK reference](../apps/treasury/reference.md), [deployment procedure](../apps/treasury/deployment.md) and [executor/receipt runbook](../apps/treasury/release-executor.md).

## Remaining acceptance — only genuine live and external dependencies

**TREASURY-AUDIT-8 (official testnet)**: retain actual chain ID/genesis/network and exact release lineage; independently verify deployed anchor and CapabilityRegistry code and actual governance/registrar; deploy all six contracts with exact constructors and reviewed signer/operator; verify one-time controller, capability and Router components and governed Registry publication. Bind real Vault and independently scoped Treasury/Vault grants; execute governed policy/budget/schedule/cancel/settle lifecycle with real native and supported token transfers and exact timing/caps/revocation/replay/rollback. Correlate canonical receipts and commitment to actual Vault transfer/finality; verify Wallet/SDK and Grants/Indexer/Explorer/Analytics same-deployment agreement; exercise actual RPC divergence/restart/reorg/rebuild and recovery and retain non-secret deployment manifests, block/tx/log identities and finality evidence. No local fixture promoted to live evidence.

**TREASURY-AUDIT-9 (independent review and final release)**: provide exact source, artifact, prior logs and [REC-9 security review](420TREASURY-REC-9-SECURITY-REVIEW.md) to independent reviewer, remediate findings and requalify changes, reconcile final production release/deployment and separately declare readiness. No security certificate is implied by local CI.

## Readiness dimensions

CODE / CONTRACT / INTEGRATION: local scope qualified by REC-2–9. BUILD / TEST: retained exact execution, current closeout gate verifies source equivalence and release reproduction. DOCUMENTATION: reconciled by REC-10. SECURITY: local engineering scope qualified, independent acceptance open. TESTNET: deployment qualification not yet executed. GENESIS / PRODUCTION: not accepted. The authoritative final closeout gate result is retained at the exact candidate and must pass before merge; no locally executable blocker is reclassified as testnet.
