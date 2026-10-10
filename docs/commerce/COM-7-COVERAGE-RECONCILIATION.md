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
fail closed. Source content, output selection and all other compiler settings are
preserved. Normal PR/CI/hardening builds continue to invoke Solidity directly.
No protocol source, test, assertion, ABI, address or authority changes in this
remediation. No coverage source or test is excluded.

Seven qualification-harness regressions verify preservation of non-optimizer
input, rejection of canonical CI/changed compiler inputs, rejection of incomplete
or duplicate assignments, preservation of uncovered lines/unknown branch hits and
failure on unsupported LCOV records. Local Level 1 passes do not establish Level 3.

A monolithic optimized diagnostic compile exceeded the 8 GiB local memory limit
and failed (Solc exit 247; cgroup OOM kill). This is not a pass. Coverage instead
reuses the canonical four-shard assignment files produced by Solidity CI. Every
production source retains emitted runtime source maps in each coverage context;
only other shards' tests/scripts are omitted from that context's output selection.
Imported dependencies remain available. The explicit test-path partition executes
every assigned test without duplicate cross-shard test execution. All four
completed exact-SHA reports are mandatory, partitions must match the canonical
inventory without omissions/duplicates, and their LCOV hits are merged. No
production source or repository test is removed from the aggregate qualification.

**Source mappings from optimized IR are approximate.** The summary and LCOV report
are diagnostic evidence, not a precise production coverage percentage or a new
coverage threshold. The complete canonical CI inventory remains the owner of
compilation, deployable size limits, 50,000-run fuzz and 2,048-run/256-depth
invariants; the coverage profile executes its retained 256-run fuzz and 64-run/
64-depth invariants. Optimized instrumentation does not replace that CI gate.

Canonical shard coverage and fixture aggregation are mandatory; main/push runs
the same coverage partition serially after its existing build/test gate. `pipefail`
propagates compiler/test failures; the LCOV report must exist and be nonempty.
Exact-SHA shard/aggregate artifacts retain execution logs, reports, compiler configuration,
source-input digest, Foundry version and candidate SHA, including failure logs.
No allowed-failure coverage result can qualify the phase.

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
