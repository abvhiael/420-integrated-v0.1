# 420Treasury TREASURY-AUDIT-3 qualification evidence

Status: **COMPLETE**  
Roadmap step: **TREASURY-AUDIT-3 — security/property/invariant expansion**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**  
Implementation SHA: `0ace5e5a8e64c2ce56b5f51e793fb7dfc4cc1468`  
Qualification base/main SHA: `27ae1873edcca8fb05dec9f4e70af9832b5dafe2`  
Audit branch: `audit/420treasury-complete-20261001`  
Pull request: **#474**  
CI workflow: **420Treasury audit qualification**  
Passing workflow run: **36970820536**  
Passing job: **110724220149**

## Canonical scope

TREASURY-AUDIT-3 expands security, property and invariant qualification for the canonical Treasury control plane without changing the custody boundary established by the prior audit steps.

The step requires:

- fuzz/property coverage for reserve/settle/release conservation;
- proof that `executed <= committed <= ceiling` remains true across arbitrary schedule/cancel/execute sequences;
- canonical-ID field-binding and replay fuzz coverage;
- policy-revision and epoch-boundary qualification;
- external dependency failure/revert qualification;
- exact-head Slither/static analysis;
- retained exact-head evidence.

420Vault remains custody/release authority. TREASURY-AUDIT-3 does not attempt to resolve the separate Vault release-evidence-model decision assigned to TREASURY-AUDIT-4.

## Implementation completed

### `contracts/src/treasury/TreasuryPolicyRegistry420.sol`

A security gap was identified during the property review: epoch spend is keyed by `block.timestamp / epochSeconds`, but `epochSeconds` was mutable on each policy revision. A governance policy update could therefore move subsequent execution into a different accounting bucket and weaken the intended current-epoch cap.

The policy registry now:

- preserves normal governance revisions to `allowed`, `maxSingleDisbursement`, and `maxEpochDisbursement`;
- freezes `epochSeconds` after the asset policy's initial revision;
- reverts later attempts to change epoch duration with `EpochDurationImmutable()`;
- preserves monotonic policy revision numbering.

This closes the epoch-bucket reset path without expanding authorization or changing Treasury custody semantics.

### `contracts/test/TreasurySecurityProperties420.t.sol`

Added a retained Treasury security/property suite covering:

1. **reserve/settle/release conservation** under fuzzed disbursement amounts and mixed execution/cancellation sequences;
2. repeated assertions that:
   - `executed <= committed`;
   - `committed <= ceiling`;
   - router remaining-budget accounting equals `ceiling - committed`;
3. **canonical-ID field binding** across recipient, amount, time-window and purpose inputs;
4. **replay rejection** for an already-scheduled canonical disbursement ID;
5. **policy revision accounting continuity**, proving that revising current caps does not erase already-spent value in the current epoch;
6. **epoch-boundary reset behavior**, proving spend can proceed under the new epoch bucket only after the actual boundary;
7. **epoch-duration immutability**, preventing policy revision from changing the bucket geometry;
8. **external capability dependency failure**, proving a reverting capability registry fails execution closed without mutating:
   - budget commitment;
   - executed accounting;
   - disbursement state;
   - epoch-spend accounting.

### `.github/workflows/treasury-audit.yml`

The retained Treasury Level 1 workflow now qualifies the TREASURY-AUDIT-3 security surface on the exact implementation SHA:

- exact-head checkout verification;
- Treasury Solidity formatting;
- Treasury contract/security-test compilation;
- retained lifecycle regression suite;
- security/property suite;
- canonical Treasury authority/config verifier;
- targeted Slither analysis for `contracts/src/treasury/**`, failing on any high-severity Treasury finding;
- forbidden-primitive scan for `tx.origin`, `selfdestruct`, and `delegatecall`.

The workflow path scope includes the retained Treasury security test file.

## Qualification history and CI diagnosis

During TREASURY-AUDIT-3 qualification, two CI-harness defects were diagnosed rather than blindly rerun:

1. an initial Foundry formatting failure was corrected by applying required production-source formatting;
2. the forbidden-primitive scanner initially failed before scanning because its Python regular expressions were over-escaped and produced `re.error: missing ), unterminated subpattern`.

The scanner was corrected. No Treasury protocol behavior was weakened, no assertion was removed, and no security check was bypassed.

Because workflow/test/config changes produce a new implementation SHA, final qualification was performed against the exact final candidate `0ace5e5a8e64c2ce56b5f51e793fb7dfc4cc1468`.

## Level 1 results on exact implementation SHA

Workflow run `36970820536`, job `110724220149`, exact implementation SHA `0ace5e5a8e64c2ce56b5f51e793fb7dfc4cc1468`:

- exact-head checkout: **PASS**
- Foundry setup: **PASS**
- Treasury Solidity formatting: **PASS**
- Treasury contracts and security tests build: **PASS**
- retained Treasury lifecycle regression suite: **PASS — 9 passed, 0 failed, 0 skipped**
- Treasury security/property suite: **PASS — 5 passed, 0 failed, 0 skipped**
- Treasury canonical authority/config boundary verifier: **PASS**
- Slither installation: **PASS**
- targeted Treasury Slither high-severity gate: **PASS — 0 high-severity Treasury findings**
- Treasury forbidden-primitive scan: **PASS**

The repository `Solidity Contracts` pull-request workflow also concluded successfully on the preceding substantive Treasury candidate and on Treasury candidates during this qualification sequence. TREASURY-AUDIT-3 completion relies on the exact-head Treasury Level 1 workflow above; it does not claim Level 3 repository-wide closeout.

## Requirements satisfied

### Reserve/settle/release conservation

Satisfied by fuzzed mixed lifecycle sequences that repeatedly reconcile budget state and router remaining-budget accounting.

### `executed <= committed <= ceiling`

Satisfied through assertions after every reservation and every fuzz-selected execute/cancel transition in the retained property test.

### Canonical-ID collision/replay boundaries

Satisfied by fuzzed field-binding checks and replay rejection for an already-scheduled exact canonical ID.

### Policy revision and epoch boundaries

Satisfied by:

- preserving current-epoch spend across policy cap revisions;
- proving the next genuine epoch permits new spend under the new bucket;
- freezing epoch duration after initialization so revisions cannot remap spend into a different bucket.

### External dependency failure/revert behavior

Satisfied by a reverting capability-registry test showing execution fails closed before Treasury accounting or lifecycle state mutates.

### Static/security analysis

Satisfied by exact-head targeted Slither with **zero high-severity Treasury findings** plus the corrected forbidden-primitive scanner.

### Exact-head retained evidence

Satisfied by workflow run `36970820536`, job `110724220149`, bound to implementation SHA `0ace5e5a8e64c2ce56b5f51e793fb7dfc4cc1468`.

## Security/adversarial result

The retained property suite and static gates found no remaining TREASURY-AUDIT-3 blocker.

The material security issue discovered during this step — mutable epoch duration remapping spend buckets — was remediated and directly qualified.

No high-severity Slither finding remains in the targeted Treasury source set, and no forbidden `tx.origin`, `selfdestruct`, or `delegatecall` primitive is present in the Treasury sources under the retained scan.

## Milestone status

TREASURY-AUDIT-3 is an ordinary app-scoped Level 1 step. It does not itself require a Level 2 Treasury integration milestone or Level 3 repository closeout.

The retained Treasury lifecycle suite was nevertheless rerun alongside the new security/property suite to protect the directly affected policy and disbursement behavior.

## Intentionally deferred

These remain owned by later canonical steps and are not blockers for TREASURY-AUDIT-3:

- final Vault release evidence-model reconciliation — TREASURY-AUDIT-4;
- modern Indexer/Explorer/Analytics integration qualification — TREASURY-AUDIT-5;
- deployment/runtime/ProtocolRegistry materialization — TREASURY-AUDIT-6;
- operator/documentation closeout — TREASURY-AUDIT-7;
- production-equivalent live testnet qualification — TREASURY-AUDIT-8;
- external security review and final Genesis/production closeout — TREASURY-AUDIT-9;
- full repository-wide Level 3 qualification, which remains owned by the canonical closeout workflows at app-phase closeout.

## Limitations

TREASURY-AUDIT-3 does not determine whether a nonzero `vaultReleaseHash` is sufficient final proof of an actual 420Vault release. That architectural/security decision is explicitly assigned to TREASURY-AUDIT-4.

This step also does not fabricate live deployment, registry, chain, Vault-release, Indexer or testnet evidence.

## Blockers

**None for TREASURY-AUDIT-3.**

TREASURY-AUDIT-4 remains blocked on its separate canonical Vault release-evidence-model decision.

## Completion determination

Every TREASURY-AUDIT-3 requirement in the canonical remediation roadmap has been implemented and directly qualified at Level 1 against exact implementation SHA `0ace5e5a8e64c2ce56b5f51e793fb7dfc4cc1468`.

**TREASURY-AUDIT-3 is COMPLETE.**

Next canonical roadmap step: **TREASURY-AUDIT-4 — Vault release evidence model**.
