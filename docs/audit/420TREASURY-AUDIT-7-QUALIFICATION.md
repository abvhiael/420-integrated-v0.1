# 420Treasury TREASURY-AUDIT-7 qualification evidence

Status: **COMPLETE**  
Roadmap step: **TREASURY-AUDIT-7 — documentation/operator closeout**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**  
Implementation SHA: `d830f464e46f7eeffaee462f3e813224e081f83c`  
Qualification base/main SHA: `27ae1873edcca8fb05dec9f4e70af9832b5dafe2`  
Audit branch: `audit/420treasury-complete-20261001`  
Pull request: **#474**  
CI workflow: **420Treasury audit qualification**  
Passing workflow run: **37048836697**  
Passing job: **110976867842**

## Canonical scope

TREASURY-AUDIT-7 closes the repository-side operator/documentation requirements for the modern Treasury protocol.

Required exit criteria:

- app/protocol-specific operator runbook;
- deployment/configuration reference;
- roles/permissions and incident/recovery procedures;
- event/error/API reference;
- explicit known-limitations section covering the Vault release evidence model;
- exact test/build commands and qualification evidence links.

The canonical classification remains unchanged: 420Treasury is a covered protocol/control plane, and a standalone public-facing Treasury website is not required.

## Gap analysis

Before this step, Treasury had strong architecture, audit and qualification evidence but lacked a dedicated operator closeout surface.

Existing repository evidence already covered:

- Treasury/Vault custody separation;
- governance/capability authority boundaries;
- the adopted commitment-only Vault release evidence model;
- Indexer/Analytics non-authoritative read semantics;
- deterministic deployment/materialization and Registry publication;
- exact retained audit qualification evidence.

Missing or partial operator-facing requirements were:

- one consolidated Treasury-specific deployment/configuration runbook;
- explicit roles/permissions table;
- Treasury-specific incident response and recovery boundaries;
- evidence-preservation procedure;
- one consolidated events/errors/API reference;
- explicit operator wording for the Vault release commitment limitation;
- exact repository build/test/verifier commands and evidence pointers;
- an exact-head verifier preventing documentation authority drift.

## Implementation completed

### `docs/apps/treasury/operator-guide.md`

Added a dedicated Treasury operator runbook covering:

- protocol purpose and custody boundary;
- component inventory;
- deployment/configuration authorities;
- frozen GovernanceTimelock and ProtocolRegistry identities;
- registry-resolved TreasuryRouter status;
- CapabilityRegistry candidate-status warning;
- exact deployment and initialization sequence;
- no-invented-CREATE2 rule;
- roles and permissions;
- normal operating procedures for policy, budget, scheduling, execution and cancellation;
- monitoring and accounting reconciliation;
- incident response for deployment/Registry mismatch, capability compromise, policy incidents, suspicious Vault release commitments and derived-service inconsistency;
- explicit incident evidence-preservation checklist;
- recovery boundaries and prohibited operator rewrites;
- known limitations;
- read/API references;
- exact build/test/verifier commands;
- links to retained qualification evidence and later live/security steps.

### `docs/apps/treasury/reference.md`

Added a consolidated developer/operator reference for:

- TreasuryAuthorization420 constructor/errors/reads;
- TreasuryPolicyRegistry420 constructor, policy error, event, writes and reads;
- TreasuryBudgetRegistry420 errors, events, governance/controller writes, reads and accounting invariant;
- TreasuryDisbursementRegistry420 states, errors, events, writes, reads and execution checks;
- TreasuryRouter420 read-only surface;
- Indexer Treasury budget and disbursement HTTP routes;
- returned derived-state fields;
- `authoritative: false` semantics;
- HTTP error-envelope behavior;
- explicit Vault release evidence warning.

### `scripts/verify-treasury-audit-7-docs.py`

Added a fail-closed Treasury documentation verifier.

It verifies:

- required operator-guide sections exist;
- required reference tokens/events/errors/routes are present;
- Treasury/Vault custody wording remains explicit;
- TreasuryRouter remains registry-resolved;
- canonical frozen GovernanceTimelock and ProtocolRegistry identities are documented;
- CapabilityRegistry candidate identity is not represented as live/frozen;
- the canonical Treasury service ID is preserved;
- `executed <= committed <= ceiling` is documented;
- Indexer read state remains non-authoritative;
- the Vault evidence model still states no Treasury-side cryptographic proof;
- live evidence remains owned by TREASURY-AUDIT-8;
- the no-standalone-site classification remains intact.

### `.github/workflows/treasury-audit.yml`

Updated the Treasury Level 1 workflow to:

- trigger on the Treasury operator/reference docs and AUDIT-7 verifier;
- run `python3 scripts/verify-treasury-audit-7-docs.py` as an exact-head required step;
- preserve all retained Treasury build, deployment, lifecycle, security/property, Grants, Indexer, Analytics, authority/config, Vault-consumer and Slither/static checks.

## Exact-head workflow history

An earlier Treasury run was triggered against pre-workflow SHA `c241d9146973458f19ab71a7912613209113a9ef` and was subsequently cancelled after branch movement. It is not counted as passing evidence.

The final implementation candidate added the workflow trigger/check and incident evidence-preservation content, producing exact implementation SHA:

`d830f464e46f7eeffaee462f3e813224e081f83c`.

Only the exact-head run on that SHA is authoritative for TREASURY-AUDIT-7.

## Exact-head Level 1 qualification

Workflow run `37048836697`, job `110976867842`, exact implementation SHA `d830f464e46f7eeffaee462f3e813224e081f83c`:

- exact-head checkout verification: **PASS**
- Foundry setup: **PASS**
- Node setup: **PASS**
- Go setup: **PASS**
- Treasury Solidity formatting: **PASS**
- Treasury + affected Grants build: **PASS**
- modern Treasury descriptor vs compiled ABI: **PASS**
- TREASURY-AUDIT-6 release materialization verifier: **PASS**
- **TREASURY-AUDIT-7 documentation/operator closeout verifier: PASS**
- compiled artifact identity retention: **PASS**
- Treasury deployment + Registry binding suite: **PASS — 4/4**
- Treasury lifecycle regression suite: **PASS — 9/9**
- Treasury security/property suite: **PASS — 5/5**
- affected Grants release-evidence suite: **PASS — 4/4**
- affected 420Indexer build: **PASS**
- Treasury Indexer descriptor/read/reorg/API qualification: **PASS — 18 tests**
- Analytics Indexer client: **PASS**
- Analytics metrics: **PASS**
- canonical Treasury authority/config verifier: **PASS**
- Vault release evidence consumer inventory: **PASS**
- targeted Treasury Slither high-severity gate: **PASS — 0 high-severity findings**
- Treasury forbidden-primitive scan: **PASS**

## Requirement-by-requirement exit verification

### App/protocol-specific operator runbook

**SATISFIED.**

`docs/apps/treasury/operator-guide.md` is the dedicated Treasury operations runbook.

### Deployment/configuration reference

**SATISFIED.**

The operator guide points to and reconciles:

- `contracts/config/treasury/treasury-audit-6-release-materialization.json`;
- `contracts/config/genesis-address-namespace.json`;
- `contracts/config/420treasury-genesis.json`.

It documents the exact deployment/initialization sequence and canonical shared identities without inventing live network addresses.

### Roles/permissions and incident/recovery procedures

**SATISFIED.**

The operator guide explicitly distinguishes GovernanceTimelock/Civic, Disbursement controller authority, scoped executors, CapabilityRegistry component authority, ProtocolRegistry, derived services and 420Vault.

It includes incident response, evidence preservation and recovery boundaries.

### Event/error/API reference

**SATISFIED.**

`docs/apps/treasury/reference.md` records the relevant Treasury events, custom errors, contract reads/writes and qualified Indexer Treasury routes plus error behavior.

### Known limitations covering Vault release evidence

**SATISFIED.**

The operator guide explicitly states the adopted `420/TREASURY/VAULT_RELEASE_COMMITMENT/V1` commitment-only model and the key limitation:

- Treasury requires exact scoped authorization and a nonzero commitment;
- Treasury does **not** cryptographically prove the commitment corresponds to an actual Vault release;
- live qualification must correlate the commitment with real Vault transaction/event/receipt evidence.

### Exact test/build commands and qualification evidence links

**SATISFIED.**

The operator guide includes exact Foundry, descriptor/release/docs verifier, Indexer and Analytics commands and links the retained audit evidence ledger through AUDIT-6 plus the canonical roadmap.

## Security/operational result

No executable Treasury contract behavior, custody boundary or authorization semantics were weakened by this documentation closeout.

The retained operator guidance reinforces:

- fail-closed authority;
- no derived-service authority;
- no operator state rewriting;
- no invented live deployment identity;
- no invented CREATE2 deployment semantics;
- exact Registry/runtime identity checks;
- explicit evidence preservation;
- explicit capability-revocation response;
- exact Vault-release trust limitation.

The retained targeted Slither gate remains clean of high-severity Treasury findings and the forbidden-primitive scan passes.

## Milestone / Level 2 status

A separate Level 2 milestone was not required for TREASURY-AUDIT-7.

This is an ordinary documentation/operator closeout step. Its directly affected documentation and retained Treasury integration/security surface were qualified in the exact-head Level 1 workflow.

## Intentionally deferred

Not blockers for TREASURY-AUDIT-7:

- production-equivalent public-testnet chain/network/genesis evidence — TREASURY-AUDIT-8;
- live Treasury deployment addresses/runtime hashes/transactions — TREASURY-AUDIT-8;
- live ProtocolRegistry publication evidence — TREASURY-AUDIT-8;
- live governed budget/schedule/cancel/execute scenarios — TREASURY-AUDIT-8;
- live policy-revocation, expiry and epoch-cap evidence — TREASURY-AUDIT-8;
- live Vault-release commitment correlation — TREASURY-AUDIT-8;
- live Indexer/Analytics/Explorer agreement and rebuild/reorg/replay drills — TREASURY-AUDIT-8;
- external security review and final Genesis/production closeout — TREASURY-AUDIT-9;
- complete repository-wide Level 3 closeout qualification.

## Limitations

Documentation qualification does not establish live deployment.

The operator runbook intentionally preserves candidate/live distinctions and points operators to AUDIT-8 for production-equivalent evidence.

No standalone Treasury website was added because the canonical classification does not require one.

## Blockers

**None for TREASURY-AUDIT-7.**

TREASURY-AUDIT-8 remains blocked until the production-equivalent testnet exists and the required live evidence can be captured.

## Completion determination

Every canonical TREASURY-AUDIT-7 requirement has been implemented and directly qualified against exact implementation SHA `d830f464e46f7eeffaee462f3e813224e081f83c`.

**TREASURY-AUDIT-7 is COMPLETE.**

Next canonical roadmap step: **TREASURY-AUDIT-8 — production-equivalent testnet qualification**.
