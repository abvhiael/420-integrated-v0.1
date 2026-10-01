# CMP-1.4.11 — Release-candidate/deployment readiness

Status: **COMPLETE — LEVEL 1 QUALIFIED. REPOSITORY-QUALIFIED RELEASE CANDIDATE; LIVE DEPLOYMENT BLOCKED.**

## Canonical definition

> Release-candidate/deployment readiness

The canonical roadmap supplies only the title for CMP-1.4.11. Repository precedent from CMP-1.3.15 therefore controls the readiness pattern: freeze the accumulated graph, pin runtime/dependency bindings, prepare truthful deployment/publication evidence, reconcile blockers, and never fabricate live addresses, transactions, blocks, runtime hashes or Registry publication.

## Repository baseline

Baseline `main`: `e8d9096c4029c3c0218113afc1cbd3b8d0005878`, the merge containing qualified CMP-1.4.10.

CMP-1.4.4 remains open on this baseline. That is an **internal deployment blocker**, not something CMP-1.4.11 may silently erase.

## Gap analysis

Before CMP-1.4.11 the repository had individually qualified verifier components and adversarial integration, but no verifier release-candidate package equivalent to the WorkerRegistry CMP-1.3.15 package.

Missing release-time controls were:

- one immutable verifier graph/code-hash audit record;
- one deployment manifest covering the accumulated verifier graph;
- explicit canonical binding inventory;
- ProtocolRegistry publication requirements;
- truthful null live-evidence fields;
- internal blocker reconciliation for CMP-1.4.4;
- external blocker reconciliation for CMP-1.5 verifier collateral and public testnet;
- a repository-ready/live-ready mechanical verifier;
- hostile release-wiring tests.

## Release-candidate wiring

Added:

`contracts/src/compute/ComputeVerifierReleaseCandidateWiring420.sol`

The checker pins exact runtime code hashes and canonical bindings for:

- `ComputeJobRegistry420`;
- `ComputeJobIntegerProfileVerification420`;
- `ComputeVerifierRegistry420`;
- `ComputeVerifierCapabilityRegistry420`;
- `ComputePolicyRegistry420`;
- `ComputeVerifierIndependencePolicy420`;
- `ComputeIndependentVerifierSelector420`;
- `ComputeReplicatedVerification420`;
- `ComputeDeterministicAdapterRegistry420`;
- `ComputeDeterministicVerificationRouter420`;
- `ComputeScientificAdapterRegistry420`;
- `ComputeScientificVerificationRouter420`;
- `ComputeDisputeResolution420`.

It verifies:

- exact chain identity;
- exact runtime code hashes;
- JobRegistry verification-evidence binding;
- JobRegistry verification-policy-registry binding;
- bounded verifier -> JobRegistry + independence-policy binding;
- verifier capability registry -> verifier registry;
- common governance across versioned verifier/policy/adapter registries;
- exact identity attestor;
- exact selector authority;
- selector -> jobs/verifier/capability/independence graph;
- replicated verifier -> selector/jobs/verifier/capability/independence graph;
- deterministic router -> jobs + deterministic registry;
- scientific router -> jobs + scientific registry + sampling authority;
- dispute hook -> the same match, authorization and independence surfaces;
- dispute jobs binding, if already installed, must point to the same JobRegistry.

It grants no authority and performs no deployment, publication, custody, settlement, stake or slash action.

## Hostile wiring qualification

Added:

`contracts/test/ComputeVerifierReleaseCandidateWiring420.t.sol`

The fixture uses the real verifier registries, policy registry, independence policy, selector, quorum verifier, deterministic/scientific registries and routers, plus the current bounded signed-verdict adapter.

Coverage includes:

- exact verifier release graph acceptance;
- wrong verifier-registry runtime hash rejection;
- mismatched deterministic router/registry rejection;
- wrong governance rejection;
- selector bound to the wrong independence graph rejection.

The repository fixture deliberately leaves live dispute entitlement/Vault deployment unbound. The release checker accepts an unbound dispute JobRegistry only in this repository state; any nonzero installed dispute jobs binding must equal the canonical release JobRegistry.

## Release manifest

Added:

`contracts/config/compute-market/cmp-1.4.11-verifier-release-candidate.json`

The manifest inventories:

- every release component;
- every canonical graph binding;
- governance/attestor/selector/sampling authorities;
- network evidence;
- ProtocolRegistry publication evidence;
- dependency gates;
- live deployment fields.

Repository mode requires all live evidence to remain null.

No fixed Genesis predeploy is allocated. The discovery/publication path remains the frozen ProtocolRegistry at:

`0x0000000000000000000000000000000000000434`

using:

`publishRegisteredService`.

## CMP-1.4.4 blocker

Repository truth still shows CMP-1.4.4 open:

> Bind every verdict to chain, contract, job, unit, attempt, worker, result, verifier, policy, evidence, nonce and expiry.

The current retained signed-verdict path has substantial provenance binding, but CMP-1.4.11 does not relabel that as canonical completion.

Therefore the manifest requires:

- `cmp_1_4_4_signed_verdict_provenance_complete = false`;
- `cmp_1_4_4_internal_release_blocker = true`;
- release gate `cmp_1_4_4_signed_verdict_provenance = false`.

Repository readiness may still be qualified because the package truthfully identifies the blocker. **Live deployment readiness must fail until CMP-1.4.4 is separately completed and qualified.**

## CMP-1.5 / collateral blocker

CMP-1.5 is the canonical ComputeStake phase after CMP-1.4.

Where live verifier admission or policy requires verifier collateral, CMP-1.4.11 forbids substituting:

- validator stake;
- wallet balance;
- payer escrow.

The canonical CMP-1.5 compute-collateral source must be independently implemented and qualified before a stake-required live verifier deployment can claim readiness.

## Public testnet and live evidence

Repository evidence does not establish a fully qualified canonical public-testnet verifier deployment for this release package.

Accordingly:

- public testnet available: **false**;
- live deployment qualified: **false**;
- ProtocolRegistry publication complete: **false**;
- deployed addresses: **null**;
- deployment transactions/blocks: **null**;
- runtime code hashes: **null**;
- release graph hash: **null**;
- live graph bindings: **null**.

These are deployment blockers, not fabricated successes.

## Mechanical verifier

Added:

`scripts/verify-cmp-1-4-11-verifier-release-candidate.py`

`--repository-ready` mode requires:

- complete source/component inventory;
- exact binding inventory;
- frozen ProtocolRegistry authority;
- no fabricated live evidence;
- CMP-1.4.1/2/3/5/6/7/8/9/10 gates complete;
- CMP-1.4.4 explicitly blocked;
- no fixed Genesis predeploy;
- CMP-1.5/public-testnet live gates blocked;
- ProtocolRegistry discovery/publication semantics preserved.

Default live mode intentionally fails until:

- CMP-1.4.4 is complete;
- real network/chain evidence exists;
- every component address/deployment transaction/block/runtime hash exists;
- every live binding exists;
- a release graph hash exists;
- CMP-1.5 collateral requirements are satisfied where applicable;
- public testnet is available;
- ProtocolRegistry publication is complete with service entries.

## Qualification model

### Level 1

Required on one exact implementation SHA:

- affected Compute contracts compile;
- verifier RC wiring tests pass;
- repository-ready mechanical verifier passes;
- live mode remains fail-closed under the current blocker state;
- retained Compute suite remains green because release wiring touches the accumulated verifier graph;
- directly triggered Solidity/Compute/Docs/Indexer/Registry/Genesis workflows pass as applicable.

### Level 2

No new Level 2 milestone is required here.

CMP-1.4.10 immediately preceding this step already ran the cross-verifier adversarial Level 2 integration suite. CMP-1.4.11 changes release wiring/evidence only and does not change verifier execution semantics.

### Level 3

Deferred to **CMP-1.4.12 — Phase closeout**.

## Exit criteria

CMP-1.4.11 is repository-qualified when:

1. release wiring and hostile wiring tests are present and green;
2. the manifest inventories the full accumulated verifier graph;
3. all repository live fields remain truthful/null;
4. Registry publication requirements are pinned;
5. CMP-1.4.4 remains an explicit live blocker;
6. CMP-1.5/public-testnet dependencies remain explicit;
7. repository-ready verification passes on the exact implementation SHA;
8. all directly applicable exact-head CI passes.

This step does **not** claim live deployment readiness while those blockers remain.

## Qualification evidence

Qualified implementation SHA:

`c5d1ccffc6937ad5fde27b85ac3d6ece8e4d84f4`

Exact successful qualification runs:

- Compute Market Qualification #69 — run `36882487806`;
- Solidity Contracts #3591 — run `36882487546`;
- 420Registry REG-AUDIT-4 #233 — run `36882487724`;
- Genesis Address Authority #398 — run `36882487532`;
- 420Indexer #1207 — run `36882487579`;
- 420Docs Qualification #3795 — run `36882487765`.

Retained Compute Market Solidity qualification on the exact implementation SHA:

- 49 test suites;
- 323 tests passed;
- 0 failed;
- 0 skipped.

The CMP-1.4.11 repository-ready verifier passed and reported `READY / LIVE BLOCKED`. The separate live-readiness fail-closed CI assertion also passed, proving that the current blocker state still prevents a false live-ready result.

Level 1: **COMPLETE / PASS**.

Level 2: **not rerun for CMP-1.4.11** because CMP-1.4.10 immediately preceding this step already qualified the cross-verifier integration milestone, and CMP-1.4.11 changes release wiring/evidence rather than verifier execution semantics.

Level 3: **deferred to CMP-1.4.12 — Phase closeout**.

Live deployment: **BLOCKED**.

CMP-1.4.4: **OPEN — explicit live-deployment blocker**.

The commits that record this qualification evidence are evidence-only and do not change executable source, tests, workflows, dependencies, interfaces, deployment state or release requirements; under the qualification model they do not recursively require a fresh qualification cycle.

## Completion

**COMPLETE — repository-qualified release candidate / live deployment blocked.**

CMP-1.4.11 is complete at repository readiness only. It does not claim live deployment readiness. CMP-1.4.4, CMP-1.5 collateral prerequisites where applicable, public-testnet evidence, deployment addresses/transactions/blocks/runtime hashes, release graph hash and ProtocolRegistry publication remain unresolved live blockers.

The next canonical roadmap step is **CMP-1.4.12 — Phase closeout**. That closeout must explicitly reconcile the still-open CMP-1.4.4 gap before any claim that the complete CMP-1.4 phase is fully closed.


## CMP-1.4.12 reconciliation note

The CMP-1.4.11 qualification above is historical evidence for its exact qualified SHA, where CMP-1.4.4 was still open. CMP-1.4.12 subsequently implements the missing canonical signed-verdict provenance requirement and updates the release manifest so CMP-1.4.4 is no longer an internal repository-release blocker.

This does not retroactively change the CMP-1.4.11 qualification SHA or its run evidence. Live deployment remains blocked by CMP-1.5 collateral where applicable, public-testnet/deployment evidence, runtime hashes/graph bindings and governance-authorized ProtocolRegistry publication.
