# GRANTS-AUDIT-8 Level 3 qualification evidence

## Step

**GRANTS-AUDIT-8 — exact-head repository qualification and durable evidence**

## Completion state

**COMPLETE**

## Qualification level

**Level 3 — complete app-phase closeout qualification**

GRANTS-AUDIT-8 is the accumulated repository closeout for the complete 420Grants audit phase. It owns current-main reconciliation, one exact merge-candidate implementation SHA, canonical repository-wide contract qualification once, separate Genesis/address-authority qualification, global documentation reconciliation, retained Grants qualification, affected client/service qualification, and durable phase evidence.

## Exact merge-candidate implementation SHA

`c95e72c8037bd52c4a7b1844104dc3e5444e2e4a`

All required Level 3 evidence recorded below is tied to this exact SHA.

## Reconciliation base

Current `main` used for reconciliation and final qualification:

`b58b09a17e641a42b81d832bad913a83c7caada9`

PR #484 state at closeout:

- branch: `feature/420grants-audit-remediation-v2`;
- base: `main`;
- head: `c95e72c8037bd52c4a7b1844104dc3e5444e2e4a`;
- mergeable: yes;
- divergence: **135 commits ahead / 0 commits behind**;
- merge base: `b58b09a17e641a42b81d832bad913a83c7caada9`;
- material PR diff: 41 files.

The accumulated Grants audit branch was reconciled to current main before comprehensive qualification. No Level 3 result below is reused from the pre-reconciliation audit head.

## Reconciliation method

The pre-closeout audit branch was deeply divergent from current `main`. Repository comparison identified only three overlapping file paths between the Grants audit changes and current-main changes:

- `420-indexer/src/index.ts`;
- `420-indexer/src/lifecycle-reducer.ts`;
- `420-indexer/src/pay-accounting-export.ts`.

The first two already contained current-main behavior plus the Grants additions. `pay-accounting-export.ts` was byte-identical on both sides.

A current-main-derived reconciliation tree was built preserving the full Grants audit file state. A content-preserving merge commit retained both audit history and the reconciled current-main-derived tree, after which PR #484 was verified at 0 commits behind current main and mergeable.

No force update was used.

## Level 3 qualification candidate history

### Reconciled candidate 1

`881a7413568030185a571b9bcae4e9d122c98763`

This was the first current-main-reconciled exact candidate.

Global Docs qualification exposed a real documentation-schema defect:

- `docs/apps/grants/threat-model.md` used front-matter category `security`;
- repository policy does not permit `security` as a page category;
- the category was corrected to the governed `architecture` category;
- no validator was weakened.

### Reconciled candidate 2

`867a8faa4636595e9f940e879041d8e92818f3dc`

Front-matter validation then passed, but global Docs exposed a separate inherited repository documentation defect:

- `docs/apps/pay/deployment-operations.md` was a governed orphan page unreachable from documentation navigation;
- `mkdocs.yml` was updated to publish the existing 420Pay deployment/operations page;
- no orphan rule or documentation safety check was disabled.

### Final exact candidate

`c95e72c8037bd52c4a7b1844104dc3e5444e2e4a`

All comprehensive Level 3 qualification below passed on this exact SHA.

## Canonical Solidity full-inventory owner

Workflow:

**Solidity Contracts #4448**

Run ID:

`37088753146`

Conclusion:

**SUCCESS**

Jobs:

- classifier `111104368584` — PASS;
- `pr-shards (0)` `111105262734` — PASS;
- `pr-shards (1)` `111105262741` — PASS;
- `pr-shards (2)` `111105262829` — PASS;
- `pr-shards (3)` `111105262888` — PASS;
- monolithic `foundry` job — SKIPPED;
- `compute-fast` — SKIPPED.

The four successful PR shards are the canonical Solidity full-inventory execution for this Level 3 candidate. The skipped monolithic `foundry` job is **not** counted as passing evidence and was not required in addition to the successful four-shard inventory. This preserves the repository rule that full Foundry qualification has one canonical owner and is not duplicated ceremonially.

## Genesis/address-authority owner

Workflow:

**Genesis Address Authority #1219**

Run ID:

`37088753244`

Conclusion:

**SUCCESS**

Job:

- `cross-manifest-authority` `111104366510` — PASS.

This separately qualified canonical frozen owners, namespace/address claims, collisions, predeploy/deployment parity, historical claim regressions and address-consumer inventory without duplicating the Solidity full Foundry inventory.

## Retained 420Grants qualification

Workflow:

**420Grants Audit Qualification #79**

Run ID:

`37088753167`

Conclusion:

**SUCCESS**

Jobs:

- `grants-contract-core` `111104414441` — PASS;
- `grants-security` `111104414660` — PASS;
- `grants-client-integration` `111106985471` — PASS.

Retained coverage includes the canonical Grants verifier, AUDIT-5 release verification, AUDIT-7 documentation verification, Grants formatting/build/lifecycle/deployment tests, security/hardening/static checks, Indexer integration and Wallet Grants handoff.

## Global documentation reconciliation

Workflow:

**420Docs Qualification #4665**

Run ID:

`37088753247`

Conclusion:

**SUCCESS**

Job:

- `qualify` `111104366298` — PASS.

The final run passed after correcting both discovered documentation defects. No skipped global Docs result is used as completion evidence.

## Affected Indexer/service qualification

### 420Indexer #1160

Run ID:

`37088753170`

Conclusion:

**SUCCESS**

Job:

- `test` `111104365858` — PASS.

### 420Indexer #2040

Run ID:

`37088753275`

Conclusion:

**SUCCESS**

Job:

- `qualify` `111104366473` — PASS.

These retain both affected Indexer test and qualification surfaces for the Grants descriptors/read models/API/lifecycle integration.

## Affected Wallet qualification

Workflow:

**420 Wallet Web Verification #1480**

Run ID:

`37088753218`

Conclusion:

**SUCCESS**

Job:

- `verify-wallet-web` `111104366758` — PASS.

This qualifies the affected Wallet web surface including the Grants handoff path on the same exact Level 3 candidate.

## 420 Integrated/global qualification applicability

`.github/workflows/qualification.yml` is path-scoped to consensus, execution, integration, node/build dependencies, Exchange and selected Compute closeout artifacts.

The final Grants Level 3 diff does not modify those owned paths or introduce a dependency from Grants into those global node/consensus surfaces.

Therefore **420 Integrated Qualification is NOT APPLICABLE to this Grants closeout candidate** and is not represented as a skipped/pass result. No ceremonial repository-wide consensus/Geth/fault/soak run was manufactured solely for closeout.

## Security / adversarial / invariant / static coverage

Security and adversarial coverage remains retained in the exact-SHA Grants workflow and the accumulated implementation:

- non-timelock governed mutation rejection;
- delegated authorization default-deny behavior;
- wrong object-scope and wrong-action rejection;
- Application nonce/content replay rejection;
- Program cap/per-Award/cumulative Application cap boundaries;
- inactive Program Award rejection;
- parent Award state enforcement;
- Milestone aggregate/ordinal boundaries;
- Treasury budget/recipient/amount/Civic/purpose/state mismatch rejection;
- duplicate Treasury disbursement binding rejection;
- PAID-before-execution rejection;
- zero Vault release-commitment rejection;
- cancellation-after-execution rejection;
- dangerous Solidity primitive scan;
- hardening-profile Grants regressions;
- targeted Slither high-severity gate.

The exact final candidate's `grants-security` job passed.

## Deployment/config verification

The final exact candidate retains and qualifies:

- `contracts/config/420grants-genesis.json`;
- `contracts/config/grants/grants-audit-5-release-materialization.json`;
- `contracts/test/GrantsDeploymentBinding420.t.sol`;
- `scripts/verify-grants-audit-5-release.py`;
- Genesis Address Authority qualification.

Canonical Grants address model remains:

`REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`

No fixed Grants predeploy or CREATE2 production-address policy was invented.

Shared frozen identities remain:

- GovernanceTimelock: `0x0000000000000000000000000000000000000429`;
- ProtocolRegistry: `0x0000000000000000000000000000000000000434`.

CapabilityRegistry420 remains a candidate reservation and is not promoted to deployed/frozen live evidence.

## Documentation fixes discovered by Level 3

Level 3 global reconciliation found and repaired two documentation defects instead of suppressing them:

1. Grants threat-model front-matter category was not in the governed category list.
2. Existing 420Pay deployment-operations documentation was unreachable from navigation.

Both fixes were incorporated into the final candidate and requalified comprehensively.

## Original GRANTS-AUDIT-8 exit criteria

### `python3 scripts/verify-grants-audit.py`

**SATISFIED** through the exact-head Grants contract-core workflow.

### Grants formatting

**SATISFIED** through retained exact-head Grants qualification.

### Grants build / bytecode-size qualification

**SATISFIED** through retained exact-head Grants qualification plus canonical Solidity inventory.

### Grants Genesis lifecycle suite under CI profile

**SATISFIED** through the exact-head Grants contract-core workflow.

### Retained hardening/security suite

**SATISFIED** through `grants-security` PASS.

### Broader affected repository CI

**SATISFIED** through canonical Solidity, Genesis Address Authority, Docs, both Indexer workflows and Wallet Web qualification.

### No unresolved failed/cancelled required checks

**SATISFIED.**

All required Level 3 owners are complete and green on the final exact candidate. Skipped unrelated or superseded runs are not counted.

### Clean branch divergence / evidence tied to one exact SHA

**SATISFIED.**

At implementation closeout PR #484 was 0 commits behind current main. All completion evidence is tied to `c95e72c8037bd52c4a7b1844104dc3e5444e2e4a`.

## Evidence-only bookkeeping validation

After the exact Level 3 implementation SHA `c95e72c8037bd52c4a7b1844104dc3e5444e2e4a` completed all required qualification, formal closeout introduced only durable audit documentation:

- `docs/audit/420GRANTS-AUDIT-8-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-REMEDIATION-ROADMAP.md`;
- `docs/audit/420GRANTS-AUDIT-REPORT.md`.

Comparison through bookkeeping head `85ed93664cac63ec78ef45481c17378e5bb02cca` showed exactly those three files and no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements.

Bookkeeping commits:

- qualification evidence: `05635a9c1c7d085f722cd199f236f6267a32b7f7`;
- roadmap formal COMPLETE status: `21dfcceeebf24ae1d60d4785047e771117931523`;
- audit-report reconciliation: `85ed93664cac63ec78ef45481c17378e5bb02cca`.

Therefore the comprehensive Level 3 results on implementation SHA `c95e72c8037bd52c4a7b1844104dc3e5444e2e4a` remain authoritative and no recursive qualification is required solely for evidence bookkeeping.

## Level 2 status

The focused Level 2 Grants/Indexer/Wallet integration milestone was completed in GRANTS-AUDIT-6.

GRANTS-AUDIT-8 does not create an additional independent Level 2 boundary; it supersedes accumulated phase qualification with Level 3 closeout.

## Live/testnet work intentionally deferred

GRANTS-AUDIT-9 remains blocked on an official production-equivalent testnet and owns durable live evidence for:

- chain/genesis identity;
- deployed Grants addresses/runtime hashes;
- constructor/immutable bindings;
- one-time Award Registry controller binding;
- live ProtocolRegistry publication/discovery;
- live CapabilityRegistry delegation;
- complete Program-to-PAID Treasury/Vault flow;
- duplicate Treasury-disbursement rejection in deployed state;
- client/indexer reconstruction from live history;
- restart/reorg/RPC-disagreement behavior.

Local Anvil, repository CI and Level 3 repository qualification do not close those requirements.

## Production/Genesis readiness boundary

GRANTS-AUDIT-8 proves repository/app-phase closeout only.

It does **not** declare TESTNET, GENESIS or PRODUCTION readiness.

GRANTS-AUDIT-10 remains blocked on GRANTS-AUDIT-9 and whole-system Genesis gates.

## Blockers

**None for GRANTS-AUDIT-8.**

## Next canonical roadmap step

**GRANTS-AUDIT-9 — production-equivalent testnet qualification**
