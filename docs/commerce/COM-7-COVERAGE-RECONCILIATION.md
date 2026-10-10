# COM-7 coverage failure remediation and main reconciliation

The earlier executable candidate `4c539aa5529e7f16aa82d434f696a31e33fbf9e1`
completed all four canonical Solidity shards, inventory aggregation and Decision
#10 fixture. Its coverage compiler failed with a Yul stack-depth exception. The
coverage step had `continue-on-error: true`, so the green workflow conclusion was
not comprehensive Level 3 acceptance. That candidate is superseded; successful
steps remain historical evidence only.

## Coverage compiler boundary

Foundry 1.8.5 implements `--ir-minimum` by disabling the peephole, inliner,
jump-destination, literal-ordering, deduplication, common-expression and constant
optimizer passes and selecting only Yul unused pruning (`u`). This configuration
cannot compile the existing repository's large ABI encoders/decoders. Fixing each
contract would unnecessarily change protocol runtime hashes and provenance.

`contracts/scripts/coverage-solc.py` instead restores the canonical Solidity
optimizer (`enabled: true`, `runs: 200`) for coverage instrumentation only. It
requires the pinned Solidity `0.8.24+commit.e11b9ed9` binary, the coverage profile,
Cancun, viaIR and the expected minimum-IR input configuration. Unexpected inputs
fail closed. Source content and all non-optimizer/non-output compiler settings are preserved.
Output selection expands to every resolved input dependency, retaining existing
fields and runtime maps for contracts called across primary ownership boundaries. Normal PR/CI/hardening builds continue to invoke Solidity directly.
No protocol source, test, assertion, ABI, address or authority changes in this
remediation. No coverage source or test is excluded.

Thirteen qualification-harness regressions verify preservation of source/other compiler
input, rejection of canonical CI/changed compiler inputs, rejection of incomplete
or duplicate assignments, preservation of uncovered lines/unknown branch hits and
failure on unsupported LCOV records. The full context-stride reconstruction check
runs before canonical compilation. Local Level 1 passes do not establish Level 3.

A monolithic optimized diagnostic compile exceeded the 8 GiB local memory limit
and failed (Solc exit 247; cgroup OOM kill). Emitting all production sources in
one broad coverage shard also exceeded this limit. Neither attempt qualifies.
Coverage now reuses the canonical four-shard assignment files produced by Solidity
CI, subdividing each into 16 bounded compiler contexts. Foundry resolves the
imports of each primary group. An exact-SHA graph snapshot captured immediately after the initial canonical build supplies
its complete dependency graph; every transitive import remains selected for
artifact retention. The bridge emits bytecode and runtime maps for
**every resolved dependency**, including contracts owned by another primary group.
Only other primary groups are omitted from that context's initial selection;
source content is never edited. The 16 context partitions must exactly reconstruct
their canonical shard, and all four shards must reconstruct the unique inventory.
Coverage explicitly disables Foundry dynamic test linking and executes native
constructors. The initial linked/sparse attempt failed with missing deployment
artifacts; those failures do not qualify. Sparse artifact retention also requires
selecting the full cached import closure, not just asking Solc for extra maps.
The test-path filters execute every assigned test without cross-context duplication.
All completed exact-SHA context reports and their merged LCOV data are mandatory.
No production source or test is removed from the aggregate qualification.
The preceding reconciled candidate `46152b4af8cb82dc4c3b4b7bb269cc614a1b5761`
passed the eight non-Solidity core workflows, but its broad coverage configuration
is superseded by this resource correction; those successes are historical evidence,
not final acceptance of the replacement candidate.

**Source mappings from optimized IR are approximate.** The summary and LCOV report
are diagnostic evidence, not a precise production coverage percentage or a new
coverage threshold. The complete canonical CI inventory remains the owner of
compilation, deployable size limits, 50,000-run fuzz and 2,048-run/256-depth
invariants; the coverage profile executes its retained 256-run fuzz and 64-run/
64-depth invariants. Optimized instrumentation does not replace that CI gate.

Canonical shard coverage and fixture aggregation are mandatory; main/push runs
the same bounded canonical compilation/test partitions serially, followed by
the same coverage partition, rather than an unbounded full-project compile. `pipefail`
propagates compiler/test failures; the LCOV report must exist and be nonempty.
Exact-SHA shard/aggregate artifacts retain execution logs, reports, compiler configuration,
source-input digest, Foundry version and candidate SHA, including failure logs.
No allowed-failure coverage result can qualify the phase.

Local Level 1 validation of the final dependency/native-constructor configuration
passed 33 tests across seven test suites, with zero failures/skips. It compiled
100 selected files in 105.09 seconds and retained observed hits in 22 production
runtime sources, including imported ProtocolRegistry, Bridge, Compute, Exchange
and High Country contracts. This is scoped harness evidence, not Level 3.

## Main reconciliation and acceptance boundary

Reconciliation includes main `c5a4f220d1fbda01f707d359aa9bb32921a138b1` (DOOBR
phase closeout). Workflow branch conflicts preserve both Commerce and DOOBR
qualification entries. Upstream sources, assertions and verification scripts are
retained. Merge commit `46152b4af8cb82dc4c3b4b7bb269cc614a1b5761` has the prior Commerce
HEAD `d2cfdd00778d642e4cef4d9a2aecfac0ae2b3f22` and current main as parents.
The coverage corrections descend from that merge; the tested tree must match the
published candidate tree exactly.

The preceding status JSON is a historical checkpoint, not acceptance of this
replacement. Comprehensive qualification and complete job/step/log inspection
remain required against one exact reconciled SHA. No skipped, queued, cancelled,
failed or allowed-failure step counts as passing. PR #594 remains draft/unmerged.
Actual chain/payment/settlement/refund/live integration evidence remains COM-8;
independent external security signoff is not claimed.


## Sparse-cache lifetime correction

Candidate `7379236e7a688d9ff0666b87f2949ff1b5b8c28b`, Solidity run
[38028988533](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38028988533),
job 114145814151, passed its assigned canonical compilation, size checks and
625 reported test cases across 107 assigned test sources. Mandatory coverage then
failed: `Canonical compilation cache lacks source script/Decision10DeploySeed420.s.sol`.
Artifact 11662850000 retains that failure and its successful preceding checks;
the candidate is **not** comprehensive Level 3 PASS.

Later sparse test commands prune the live cache's script entries. The qualifier
now snapshots the complete compiler dependency graph immediately after its initial
assigned build, before production size and per-file test commands. Coverage reads
that retained snapshot once and verifies exact SHA, CI profile, owner partition
and complete transitive dependency closure. It never substitutes a later mutable
cache or silently omits a missing script/dependency. The snapshot is retained in
the owning shard artifact. Two regressions reproduce post-build script pruning
and reject absent, wrong-SHA/profile/partition or incomplete snapshots. Existing
source, test, assertion, compiler, fuzz/invariant and aggregate gates remain intact.
The replacement candidate requires actual executed qualification; this correction
does not manufacture a pass from the failed coverage job.

## Additional native coverage compiler failure

Candidate `f6a642b33d2a59ff94387e94cf56c3aed899c631` did not qualify Level 3.
All 24 executed non-Solidity workflows passed. Its shard 0 normal canonical
CI step passed 625 reported cases across 107 assigned test files, but native
coverage context 9 failed with a pinned Solc Yul stack-depth exception after
nine successful coverage contexts. Run 38032286595, job 114155612335;
artifact 11664425353, digest
`sha256:8a1dd861c102f1e7c7e4dc74a5544262ef397daa5016185200c35f83e1f5611a`.
The earlier cache-loss failure did not recur. This failure is not waived.

The coverage-only bridge now retains exact standard-JSON inputs, input/source
hashes, optimizer settings and errors for each compiler attempt. Only a
`YulException` stack-depth error may receive one bounded retry using Solidity
0.8.24's documented non-inlining optimizer sequence
`dhfoD[xarrscLMcCTU]uljmul:fDnTOcmu`.
Reference: [Solidity 0.8.24 optimizer selection](https://docs.soliditylang.org/en/v0.8.24/internals/optimizer.html#selecting-optimizations).
The pinned compiler, optimizer runs 200, Cancun/viaIR, source contents,
all non-optimizer settings, dependency maps and selected inventory stay intact.
Canonical production compilation and CI fuzz/invariant budgets remain unchanged.
Coverage source mapping remains approximate and diagnostic.

Syntax errors, other compiler failures, mixed error types and an unsuccessful
retry remain fatal; no job is allowed to continue on error. Four additional
regressions require default-success/no-retry, exact error gating, unchanged
source/settings plus retained failed evidence, and an unsuccessful bounded retry.
There are 17 harness checks before canonical compilation. Their actual CI results
and complete final-candidate Level 3 remain pending; this proposal is not a PASS.

## Executable bridge mode correction

Candidate `2f576b41ecaee19e48f607f405f8ab9580111b54` is NOT Level 3 qualified.
Shard 1's canonical CI step passed 663 reported cases across 106 assigned test
files, but mandatory coverage could not start:
`"./scripts/coverage-solc.py": Permission denied (os error 13)`.
Run 38035654957 / job 114165461822, artifact 11665230200.
The API tree update incorrectly set this directly invoked bridge to mode 100644.
Restore mode 100755 without changing its content, and add an executable-access
regression before canonical compilation. There are 18 harness checks.
The preceding 17 boundary checks passed, but did not check the file mode.
The bounded Yul compiler retry has not yet been exercised by this candidate;
its actual execution and complete replacement Level 3 remain mandatory.

## Native coverage failure retained for focused replay

Candidate `23ea85c907a37791584ffb6c3c9bf741427fc50f` is NOT qualified.
Normal shard 0 passed, but mandatory context 9 failed with a native Yul
stack-depth error, run 38038205736 / job 114173041314.
Artifact 11664864891, digest
`sha256:0457c9652c31ea28f5f1924895c8d61616f71dc91e87add5f36c8e0ae1fd8d5c`.
The execute-mode guard passed; it did not resolve this compiler failure.
A temporary native replay checks unchanged source contents against the retained
exact compiler input and reports bounded optimizer experiments. It deliberately
fails and blocks new canonical shards until the correction is selected; it is
not test execution or Level 3 acceptance. Remove the one-time replay dependency
before final qualification. No runtime source or test assertion is changed.

The first native replay (run 38040847380 / job 114180663032) confirmed both
retained compiler attempts fail with unchanged 100-source input. Size runs 1,
non-inlining and a late-inlining experiment also fail. Those results are diagnostic,
not PASS. A second replay uses the actual Solc 0.8.24 default pass sequence,
orders expression splitting before full inlining, and isolates the six selected
test targets to identify the compiler-sensitive fixture. Production and test
sources remain unchanged; all canonical shards remain blocked during diagnosis.
