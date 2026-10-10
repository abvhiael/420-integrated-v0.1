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

Eleven qualification-harness regressions verify preservation of source/other compiler
input, rejection of canonical CI/changed compiler inputs, rejection of incomplete
or duplicate assignments, preservation of uncovered lines/unknown branch hits and
failure on unsupported LCOV records. The full context-stride reconstruction check
runs before canonical compilation. Local Level 1 passes do not establish Level 3.

A monolithic optimized diagnostic compile exceeded the 8 GiB local memory limit
and failed (Solc exit 247; cgroup OOM kill). Emitting all production sources in
one broad coverage shard also exceeded this limit. Neither attempt qualifies.
Coverage now reuses the canonical four-shard assignment files produced by Solidity
CI, subdividing each into 16 bounded compiler contexts. Foundry resolves the
imports of each primary group. The immutable canonical compilation cache supplies
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
retained. The replacement commit must have both the prior Commerce HEAD and
current main as parents; its tested tree must match the published tree exactly.

The preceding status JSON is a historical checkpoint, not acceptance of this
replacement. Comprehensive qualification and complete job/step/log inspection
remain required against one exact reconciled SHA. No skipped, queued, cancelled,
failed or allowed-failure step counts as passing. PR #594 remains draft/unmerged.
Actual chain/payment/settlement/refund/live integration evidence remains COM-8;
independent external security signoff is not claimed.
