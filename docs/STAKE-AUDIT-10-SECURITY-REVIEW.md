# STAKE-AUDIT-10 — Security review and closeout preparation

This is the repository security preparation record. Independent external review,
reviewer remediation acceptance, final Genesis approval and deployed public-testnet
acceptance remain open. No external audit certificate or deployed safety claim is
created by local checks. The canonical next acceptance work is the existing
STAKE-AUDIT-8/9 live worklist and STAKE-AUDIT-10 independent review/final approval;
there is no additional invented audit step.

## Scope and authority

Review ValidatorRegistry, CommunityValidatorReserve, RewardController,
ConsensusSystemCall420, Stake420 and their complete Solidity import closure;
consensus outcome/history, signing protection, checkpoint and sequence persistence;
native Geth patch execution, Indexer canonical reconstruction, accounting and alarms.
The generated independent-review archive retains Solidity sources, tests, frozen
predeploy manifests/artifacts, security policy, runtime sources and previous
operational records. Its result manifest binds candidate SHA, tree, source hashes,
compiler/tool versions, original regression evidence and artifact hashes.

Governance is the immutable GovernanceTimelock, not a public operator account.
It binds consensus authority once to the frozen gateway, assigns reserve credit
and may spend only unencumbered reserve balance. It cannot directly author reward,
slash, exit or lifecycle outcomes. Native SystemAddress alone enters the gateway;
chain, execution block, canonical parent, sequence, action, target and selector
must match. Consensus history/finality is settlement authority; RPC observations,
Indexer projections, accounting reports and alarms cannot create settlement.

Owned collateral can leave only through a consensus-adjudicated slash to
ProtocolReserve or withdrawal to the registered withdrawal recipient after the
hold and shared safety checks. Protocol credit returns to CommunityValidatorReserve.
Withdrawal zeroes balances and changes status before the callback; a callback
cannot withdraw twice. Failed downstream transfers roll back the whole transaction.
RewardController records accrual; it has no arbitrary native reward payout method.
This is an authorization claim for the reviewed implementation, not a claim that
compromised governance, altered predeploys or stolen operator keys are safe.

## Previous findings reconciliation

The historical September audit remains an immutable historical snapshot. Current
source and tests supersede its historical missing-implementation descriptions:

| Historical finding | Current disposition and retained qualification |
| --- | --- |
| Slash evidence replay | Global evidence consumption before mutation; invariant, lifecycle and property suites |
| Reward semantic replay | Current-block binding and one reward per block; gateway/reward regression suites |
| Malformed participant sets | Nonzero, distinct, bounded participants excluding proposer; property/invariant suites |
| Incomplete slash lifecycle events | Canonical resultingStatus emitted and projected; ABI and Indexer qualification |
| Stale public ABI | Frozen ABI vectors and retained predeploy verifier |
| Obsolete Indexer lifecycle mapping | Canonical events, canonical replacement reconstruction and duplicate suppression; 9.3 |
| Missing production outcome materialization | Verified history/settlement boundary, native batch derivation and process qualification; 9.2/9.6 |
| Frozen dependencies and safety integration | Runtime-code-bound ProtocolRegistry dependency and NORMAL_ONLY activation / WITHDRAWAL_ONLY mature withdrawal; genesis/security suites |
| Initialization/migration introspection | One-time genesis/config identity and version introspection; no discretionary live migration authorization added |
| Missing runtime/storage artifacts | Retained offline predeploy materialization and frozen manifests verified; deployed identity remains live acceptance |
| PENDING_HARDENING suite status | Current PRE_GENESIS_EXECUTABLE_VERIFICATION and external_audit_required=true remain unchanged |
| Missing independent audit | OPEN_EXTERNAL; deliver generated review package to an independent reviewer |

Two additional defects were found: the deployable safety provider was missing, and the operator reserve address was wrong. The new `StakeSystemSafety420` implements the frozen Stake action classes through the real Registry/code-hash boundary. Only the immutable timelock can change state or action denial, recovery requires nonzero evidence, unknown components/actions/class substitutions are denied, and mature withdrawals remain available unless explicitly denied. The existing timelock delay floors are preserved; no immediate emergency bypass is introduced. Its deployment manifest records no fabricated address or live binding. It must not replace an existing shared provider without reconciling every consumer; non-Stake policy remains outside this scoped implementation.

The documentation defect was found during this review: the 9.7 runbook mislabeled
CommunityValidatorReserve as `0x…0424`. The frozen manifest correctly assigns it
`0x…0425`; ProtocolReserve is `0x…0424`. The prose is corrected, manifest-checked,
and all previously qualified shell command blocks are required to remain identical.
No frozen contract address, existing runtime bytecode, economics or finalized rule changes. The new companion safety-provider bytecode and deployment requirements are retained separately.

## Static and adversarial qualification

Run `python3 scripts/qualify-stake-security.py --output /tmp/stake-security` with
Slither 0.11.3, solc 0.8.24, Foundry and Go available. FOUNDRY_SOLC selects the
pinned compiler. The original isolated Stake owner suite retains the repository
Foundry profile (default: fuzz 10,000, invariant 512 runs/depth 128). The optional
`--reuse-solidity` accepts only already executed, hash-identical owner logs and
configuration; it never converts missing or changed evidence into success. `--verify-retained` verifies the retained original and focused executions against exact input hashes, builds a candidate-bound reviewer package and avoids rerunning unchanged passing suites. The CI result distinguishes inherited execution from newly executed tests.

Slither runs all default detectors against the full five-contract import closure and separately the production safety provider with its actual GovernanceTimelock and ProtocolRegistry,
using optimized via-IR Cancun compilation. Every observed finding has an individual
source-bound disposition in STAKE-AUDIT-10-STATIC-REVIEW.json. New/removed findings
or changed reviewed sources fail closed for renewed review. No detector category
is globally suppressed. Review dispositions are local engineering assessments,
not independent auditor acceptance. Go vet covers consensus, native execution
system calls and Indexer packages. New authorization tests exercise governance and
outsider reward/slash/exit forgery, reserve spending and binding changes, and withdrawal attempts by the owner, governance and an unrelated account; a real
recipient callback attempts a second withdrawal. Three additional production-provider tests exercise real ProtocolRegistry publication and code identity, timelock delay, authorization, operation replay rejection, recovery evidence, explicit action denial and halted activation through ValidatorRegistry. The first activation fixture mistakenly attempted ELIGIBLE instead of ACTIVE and failed its assertion; the fixture was corrected to the canonical activation transition. Its original log and the successful targeted retry remain retained, with the unchanged passing test bodies source-bound. The final provider suite was then rerun against the real ProtocolRegistry and timelock because that setup materially replaced mock publication; all three cases passed. Original rollback, stateful
invariant, fuzz, lifecycle, ABI and accounting suites are retained in full.

The artifact includes actual logs, raw Slither JSON, reviewed finding identities,
predeploy structural checks, source hashes, archive digest and exact candidate.
A failing command cannot produce a PASS result. Test failures must be diagnosed
from retained logs and fixed before publication or merge.

The retained original run reports 59 passing test results, including five invariant
properties in one 512-run/65,536-call campaign with zero reverts. Seven focused
security cases and 12 adversarial qualification-gate checks pass. Slither reports
34 reviewed findings across the two scopes (no high-severity finding); the raw
reports and individual engineering dispositions remain visible. Go vet and the
frozen predeploy structural verifier pass. The original three-case provider
fixture had one failed assertion before its transition correction; the final
three-case production Registry/timelock suite passes. No initial failure is erased
or represented as a successful execution.

The workflow artifact's `result.json` is the authoritative exact-candidate record:
repository commit, full tree, run ID, source bindings, retained execution origins,
reviewed findings, reviewer archive digest and explicit external/live status. The
PR qualification record links the resulting workflow and downloadable artifact.
The archive contains no operator data directory, JWT, signing key or webhook token;
public deterministic test fixtures remain identifiable as source fixtures.

## Preserved operational evidence

Use the authoritative [9.8 ledger](STAKE-AUDIT-9.8-OPERATIONAL-QUALIFICATION.json)
and [closeout record](STAKE-AUDIT-9.8-OPERATIONAL-CLOSEOUT.md) for original bindings
and limitations. Earlier evidence is not relabeled as this candidate's execution.
The runbook prose correction supersedes only its address text, not the unchanged
20 command groups or prior runtime behavior.

| Step | Qualified candidate | Original workflow runs |
| --- | --- | --- |
| 9.1 | 3cfd666c3723d8bf2db2bdc66338fe800950f533 | 44146233112 |
| 9.2 | 74274d07c4d0e432ebb7f0fc8f610dc04d32bed2 | 44130324547, 44130324320, 44130324379 |
| 9.3 | 3627687a0a35542de2e5f2972dce7d16fe659263 | 44137388796 |
| 9.4 | f738795fcf88f3b22f443db17a355f4a9ccc4da1 | 44159878305, 44159878183, 44159878518 |
| 9.5 | 4561e95809e672a3b69177fbcd069a5f35c1551b | 44173816629, 44173816598, 44173816647 |
| 9.6 | f1bd533fc09675da248068bc636cb85a48ffd730 | 44178284286, 44178284273 |
| 9.7 | fa417175a4665c75ce7ccc0e11f1c26b8abaa1d8 | 44193039776 |
| 9.8 | f5169643be34978b08e45d3eaee6dbe838f42ea2 | 44205139224 |

## Independent reviewer handoff and outstanding acceptance

Review the complete authority and native execution boundaries, all per-finding
static dispositions, dependency-code identity and shared emergency safety policy,
slashing and withdrawal arithmetic/atomicity, history/finality recovery rules,
BLS signing protection, and projection/accounting trust separation. Reproduce
source-bound checks and inspect original operational evidence with its documented
fixture/real-process limits. Report findings with file/line, exploit preconditions,
impact, reproduction and remediation validation. No reviewer has been appointed
or represented as having approved this implementation.

Deployment-dependent acceptance is exclusively the existing
[operational worklist](STAKE-TESTNET-OPERATIONAL-ACCEPTANCE.md): live code/storage,
Registry and timelock identities, native origin, custody/signing separation,
real lifecycle outcomes, restart/reorganization evidence and destination delivery.
External security review is an independent-review dependency, not a local test
silently deferred to testnet. Final Genesis GO and security-suite promotion require
those genuine acceptances; PRE_GENESIS_EXECUTABLE_VERIFICATION is preserved.
