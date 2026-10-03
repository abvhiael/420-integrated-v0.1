# GRANTS-AUDIT-7 qualification evidence

## Step

**GRANTS-AUDIT-7 — documentation, threat model and operator guidance**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

This step changes documentation, documentation verification, architecture cross-links and the app-specific Grants CI path. It does not introduce new runtime authority, contract semantics, deployment addresses or shared client behavior. No new Level 2 milestone is required; the prior client/indexer milestone was completed in GRANTS-AUDIT-6. Level 3 remains GRANTS-AUDIT-8.

## Exact implementation SHA

`14c6732aa1d30bed5e5e5459ee930bafc9c54426`

## Branch / PR / main state at qualification

- branch: `feature/420grants-audit-remediation-v2`
- PR: #484 — `audit(grants): harden lifecycle and establish 420Grants audit track`
- PR state at qualification: OPEN / mergeable
- current main observed during qualification: `b58b09a17e641a42b81d832bad913a83c7caada9`
- branch divergence at qualification: 87 commits ahead / 400 commits behind current main
- merge base: `14d46231aa4350b2e84dee52f0f664bdd2e785f4`

Accumulated reconciliation against current `main` remains explicitly owned by GRANTS-AUDIT-8 Level 3 and is not an ordinary AUDIT-7 exit criterion.

## Canonical purpose

GRANTS-AUDIT-7 closes the documentation surface for repository-qualified Grants behavior by ensuring that:

- the canonical architecture remains authoritative and cross-linked;
- the audit report reflects actual repository state;
- the Genesis config/release materialization remain the source of deployment/address/security invariants;
- operators have explicit deployment, authority, monitoring, incident and recovery guidance;
- security reviewers have an explicit Grants threat model;
- known live/testnet limitations remain visible and are not promoted into repository-qualified claims.

## Implementation completed

### Operator runbook

Added:

`docs/apps/grants/operator-guide.md`

The runbook documents:

- canonical Grants components;
- deployment and Registry publication sequence;
- GovernanceTimelock / ProtocolRegistry / CapabilityRegistry identities and status;
- roles and permissions;
- Program, Application, Award and Milestone operating procedure;
- exact Treasury binding and PAID requirements;
- monitoring and reconciliation invariants;
- Registry/runtime/dependency mismatch handling;
- capability compromise response;
- accounting discrepancy response;
- suspicious payment-evidence response;
- Indexer/Wallet disagreement handling;
- incident evidence preservation;
- recovery boundaries;
- commitment-only Treasury/Vault evidence limitation;
- registry-resolved address limitations;
- non-authoritative Indexer/API behavior;
- exact repository qualification commands;
- retained qualification evidence.

The guide explicitly states that Indexer projections are returned with `authoritative: false` and that Grants does not independently prove Vault transfer from a nonzero Treasury release commitment.

### Threat model

Added:

`docs/apps/grants/threat-model.md`

The threat model records:

- security objectives;
- trust boundaries;
- governance-bypass threats;
- capability overreach;
- Application replay/substitution;
- cap/accounting bypass;
- inactive/cancelled parent bypass;
- Treasury substitution;
- duplicate Treasury funding;
- detachment from executable/executed payment;
- false PAID evidence;
- direct custody/transfer expansion;
- Registry/service substitution;
- derived-state authority confusion;
- reorg/RPC disagreement;
- evidence-preservation risk;
- abuse cases that must fail closed;
- monitoring signals;
- recovery principles;
- residual/live-only risks.

### Canonical audit report

Added:

`docs/audit/420GRANTS-AUDIT-REPORT.md`

The report reconciles:

- Grants classification and authority boundaries;
- implementation inventory;
- completed remediation through AUDIT-6;
- address/deployment state;
- client/indexer state;
- threat-model summary;
- Treasury/Vault commitment-only trust limitation;
- qualification ownership;
- AUDIT-8 Level 3 closeout responsibility;
- AUDIT-9 production-equivalent testnet blockers;
- AUDIT-10 readiness boundary.

### Architecture cross-links

Updated:

`docs/architecture/protocols/stake-governance-treasury-grants.md`

Added direct links to:

- Grants operator guide;
- Grants threat model;
- Grants audit report.

No architecture authority semantics were changed.

### Fail-closed documentation verifier

Added:

`scripts/verify-grants-audit-7-docs.py`

The verifier checks:

- required operator guide sections and canonical tokens;
- required threat-model sections/threats;
- audit-report scope/status/qualification sections;
- canonical architecture Grants authority/recovery invariants;
- Grants Genesis config schema/classification/address model;
- all GRANT-INV-001..019 entries;
- release materialization repository/live boundary;
- frozen GovernanceTimelock and ProtocolRegistry identities;
- CapabilityRegistry candidate status;
- GRANTS-AUDIT-9 ownership of live evidence;
- non-standalone website classification;
- explicit no-custody boundary;
- exact non-authoritative Indexer marker.

### CI ownership

Updated:

`.github/workflows/grants-audit.yml`

Added path ownership for:

- `scripts/verify-grants-audit-7-docs.py`;
- `docs/apps/grants/**`;
- `docs/architecture/protocols/stake-governance-treasury-grants.md`.

Added exact-head step:

`python3 scripts/verify-grants-audit-7-docs.py`

This keeps AUDIT-7 qualification app-specific and exact-SHA rather than depending on global Docs CI.

## Qualification history

### Initial AUDIT-7 candidate

Implementation SHA:

`47592e72fee02a31c0ff20abca0cb0ffbff96bd0`

420Grants Audit Qualification run:

`37085738944` / #67

The Grants audit model and AUDIT-5 release verifier passed. The new AUDIT-7 documentation verifier failed with:

`operator guide missing canonical token: authoritative: false`

Classification:

**documentation defect**, not protocol/runtime failure.

The operator guide described Indexer state as non-authoritative but did not state the exact API contract marker. The documentation was corrected rather than weakening the verifier.

### Final exact-head qualification

Implementation SHA:

`14c6732aa1d30bed5e5e5459ee930bafc9c54426`

Workflow:

**420Grants Audit Qualification**

Run:

`37086042799` / #68

Conclusion:

**SUCCESS**

#### grants-contract-core

Job:

`111096496881`

Result:

**PASS**

Directly relevant coverage includes:

- exact-head checkout/SHA verification;
- `scripts/verify-grants-audit.py`;
- `scripts/verify-grants-audit-5-release.py`;
- `scripts/verify-grants-audit-7-docs.py` — PASS;
- retained Grants formatting/build/deployment/lifecycle regression gates.

#### grants-security

Job:

`111096497208`

Result:

**PASS**

Retained security coverage includes:

- forbidden primitive scan;
- hardening-profile Grants regressions;
- targeted Grants Slither high-severity gate.

#### grants-client-integration

Job:

`111098474470`

Result:

**PASS**

Although AUDIT-7 does not introduce a new Level 2 milestone, the existing workflow dependency retained the previously qualified Grants client integration seam on the exact same implementation SHA and remained green.

## Affected shared Solidity workflow

Workflow:

**Solidity Contracts**

Run:

`37086042862` / #4399

Conclusion:

**SUCCESS**

Same exact implementation SHA:

`14c6732aa1d30bed5e5e5459ee930bafc9c54426`

Jobs:

- `classify-pr` job `111096584447` — PASS;
- `compute-fast` job `111096611080` — PASS;
- `foundry` — correctly SKIPPED;
- `pr-shards` — correctly SKIPPED.

The skipped full Foundry/pr-shard jobs are not counted as passing evidence. They were not required for this documentation-focused ordinary step. The applicable fast-path job passed.

## Docs/global workflow

420Docs Qualification run `37086042760` / #4616 resolved as SKIPPED under its current path/classification policy.

This skip is not counted as passing evidence.

Global Docs reconciliation is intentionally deferred to GRANTS-AUDIT-8 Level 3. AUDIT-7's directly applicable documentation contract is owned and passed by the exact-head app-specific Grants verifier.

## Bookkeeping requalification / evidence reuse validation

After exact-head implementation qualification passed, closeout introduced documentation bookkeeping only.

Comparison from implementation SHA `14c6732aa1d30bed5e5e5459ee930bafc9c54426` through bookkeeping head `28657a38c8f82a8d777ec55f6f5ec5399c9e43e3` contains only:

- `docs/audit/420GRANTS-AUDIT-7-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-REMEDIATION-ROADMAP.md`;
- `docs/audit/420GRANTS-AUDIT-REPORT.md`.

No executable source, test, workflow, dependency, configuration, generated/runtime artifact, interface, deployment state or substantive requirement changed.

Therefore exact-SHA 420Grants run `37086042799` / #68 and affected Solidity run `37086042862` / #4399 remain authoritative for GRANTS-AUDIT-7. No recursive qualification is required solely for evidence bookkeeping.

Evidence document creation commit: `ce02105c798d645b579f952a6513cb1464fbff82`.  
Roadmap completion commit: `3adcd4ab81f898f37b1f66587bbaeaab930f8497`.  
Audit-report reconciliation commit: `28657a38c8f82a8d777ec55f6f5ec5399c9e43e3`.

## Requirement-by-requirement exit verification

### Canonical architecture remains authoritative

**SATISFIED.**

`docs/architecture/protocols/stake-governance-treasury-grants.md` remains the canonical architecture document and now links directly to the Grants operator/threat/audit artifacts.

### Audit report records actual repository state

**SATISFIED.**

`docs/audit/420GRANTS-AUDIT-REPORT.md` records repository-qualified state, qualification ownership and explicit deferred work without claiming live deployment.

### Remediation roadmap records actual status

**SATISFIED.**

The roadmap records completed prior steps, AUDIT-7 closeout evidence, AUDIT-8 Level 3 ownership, and live/testnet gates.

### Genesis config records deployment/address/security invariants

**SATISFIED.**

The AUDIT-7 verifier checks the canonical Grants Genesis config, release-materialization pointer, address model and GRANT-INV-001..019 inventory.

### Operator guidance exists and is repository-grounded

**SATISFIED.**

The operator guide covers deployment, authority, normal operations, monitoring, incident response, evidence preservation, recovery and live limitations.

### Threat model exists and is repository-grounded

**SATISFIED.**

The threat model covers the authority/custody/delegation/payment/client trust boundaries and retained fail-closed abuse cases.

### Known live/testnet blockers remain explicit

**SATISFIED.**

GRANTS-AUDIT-9 remains the sole owner of production-equivalent live deployment and Treasury/Vault correlation evidence.

### No false standalone Grants website requirement

**SATISFIED.**

The operator guide and verifier preserve the canonical classification that no standalone Grants website is required.

## Level 2 status

**NOT TRIGGERED for GRANTS-AUDIT-7.**

AUDIT-7 is documentation/operator/security-guidance closeout and introduces no new runtime integration milestone. The prior focused Level 2 Grants/Indexer/Wallet milestone completed in AUDIT-6 and remained green in the retained exact-head workflow.

## Intentionally deferred Level 3 work

GRANTS-AUDIT-8 owns:

- reconciliation against then-current `main`;
- one exact accumulated merge-candidate implementation SHA;
- canonical full Solidity inventory once;
- separate Genesis/address-authority qualification without duplicating full Foundry;
- global/420 Integrated qualification where applicable;
- Docs/global reconciliation;
- retained Grants/client/service/Indexer qualification;
- security/static/deployment/config verification;
- final roadmap/audit/evidence reconciliation.

## Intentionally deferred live work

GRANTS-AUDIT-9 owns production-equivalent evidence for:

- chain/genesis identity;
- deployed Grants addresses/runtime hashes;
- constructor/immutable bindings;
- Award Registry controller binding;
- live Registry publication/discovery;
- live CapabilityRegistry delegation;
- complete program-to-PAID Treasury/Vault flow;
- duplicate Treasury-disbursement rejection;
- live client/indexer reconstruction;
- restart/reorg/RPC-disagreement behavior.

## Limitations

Repository documentation qualification proves the documentation is consistent with the retained repository/config/release model. It does not prove live deployment, live operator behavior, external security review or production readiness.

## Blockers

**None for GRANTS-AUDIT-7.**

Current branch/main divergence is a GRANTS-AUDIT-8 Level 3 concern and is not an AUDIT-7 blocker.

## Completion state

**COMPLETE**

Next canonical roadmap step:

**GRANTS-AUDIT-8 — exact-head repository qualification and durable evidence**
