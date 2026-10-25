# HC-NEXT-6.1 — Yul compiler investigation and qualification

Status: **BLOCKED — do not merge**. The compiler fix and affected runtime regressions are qualified (585 poker tests and six land tests passed). The separate FantasyContestEngine420 production size gate fails. This is not a Genesis or phase-wide qualification certificate.

## Exact snapshots

- Original PR head: `cb6f8e38ae6512fc51b0ff19a618e3c2fc6c58da`.
- Main used for the unchanged shard attempt and targeted reproduction: `043dfe1420b5e29b273bca31377dc3f8afc409ee`.
- Reconciled main: `1995edc3df97359570e403cc6ab2999928198b33`. Changes since the reproduction baseline affect only High Country UI/artwork, with no changes to contracts or the economy service.
- Implementation snapshot: `e5cc476ff449215245cbbbfed04b08d7db4f86de`.
- Implementation tree: `cb529e1e40c683340753581c45d087ed8529df2e`, independently matched between local Git and GitHub before publishing.
- Subsequent evidence/prose-only commits inherit this implementation snapshot; they do not create new runtime qualification claims.

## Root cause and smallest production-neutral fix

The failure is pre-existing test-fixture code, not LandRegistry. With the full captured Forge source graph and unchanged compiler settings, selecting only `PokerNLHEBetting54Case9Test` reproduces the exact diagnostic:

```text
Yul exception:Variable var_id is 1 too deep in the stack [ var_id RET cleaned _5 _3 _7 _2 _11 _16 _23 _25 _28 _17 _15 _21 _27 _29 ]
memoryguard was present.
```

The [native optimized-Yul excerpt](evidence/hc-next-6.1-yul/case9-helper-before.yul) identifies `fun_readyFrozenAssignmentWithoutDelivery()` in `contracts/test/BetPokerNLHEBetting54.t.sol`. The listed variables are the helper's hand ID, return address and long-lived ABI/call temporaries around its two shuffle stages. This is an IR stack-allocation failure despite a memory guard. Removing an unused Hand read alone did not resolve it; that trial was discarded.

The final fix gives each shuffle stage a real, self-only fixture call boundary. Stage 1 still uses PROVIDER_A and the canonical initial root; stage 2 still uses PROVIDER_B and stage 1's output. Both proof byte strings and the resulting root remain unchanged. Production contracts, authorization, escrow, settlement and provider-bond logic are untouched by the compiler fix.

All 18 existing test entry points and all 80 existing require/assert statements in the changed fixture file remain present. The only added assertion restricts the external fixture helper to calls from the fixture itself. No tests, adversarial assertions, via-IR compilation or EIP-170 enforcement were removed or disabled.

## Toolchain and resource boundary

Foundry 1.8.6, commit `6bad0a66de7c83f7b33695044138f0f5fa4c5990`; native Solc 0.8.24. The `pr` profile retains Cancun, optimizer enabled with 200 runs, via-IR, 2,500 fuzz runs and 128 invariant runs at depth 64. See [toolchain](evidence/hc-next-6.1-yul/toolchain.txt).

The original command was attempted unchanged on main:

```sh
cd contracts
PATH=/tmp/foundry186:$PATH FOUNDRY_PROFILE=pr bash scripts/qualify-foundry-shard.sh 0 4
```

Its 700-output-unit compilation reached this host's 8 GiB memory ceiling and was stopped (exit 130). It supplies no compiler or test pass. The exact Forge standard-JSON input was then captured with [capture-solc.py](evidence/hc-next-6.1-yul/capture-solc.py); targeted output selection kept the complete source graph, compiler and settings unchanged. [isolate-output.py](evidence/hc-next-6.1-yul/isolate-output.py) records the actual isolation orchestration used:

```sh
FOUNDRY_SOLC=/tmp/capture-solc PATH=/tmp/foundry186:$PATH FOUNDRY_PROFILE=pr bash scripts/qualify-foundry-shard.sh 0 4
ISOLATE_CONTRACTS=PokerNLHEBetting54Case9Test python /tmp/exact-isolate.py test/BetPokerNLHEBetting54.t.sol
ISOLATE_CONTRACTS=PokerNLHEBetting54Case9Test python /tmp/exact-ir.py test/BetPokerNLHEBetting54.t.sol
ISOLATE_CONTRACTS=PokerNLHEBetting54Case9Test ISOLATE_OVERRIDE=/workspace/scratch/4fd7cac96e64/pr823/contracts/test/BetPokerNLHEBetting54.t.sol python /tmp/exact-isolate.py test/BetPokerNLHEBetting54.t.sol
```

[Original isolated failure](evidence/hc-next-6.1-yul/main-case9-before.json), [two-file reproduction](evidence/hc-next-6.1-yul/main-yul-reproduction.json), and [fixed Case9 compiler result](evidence/hc-next-6.1-yul/candidate-case9-after.json) are retained. Compiler success alone is not runtime qualification.

## Scoped execution

The source/test inventory is bounded for these commands; the compiler settings, PR profile, test bodies and security assertions are unchanged. Empty source/script directories prevent unrelated application roots from being compiled while normal imports include the affected dependency graph.

```sh
PATH=/tmp/foundry186:$PATH FOUNDRY_PROFILE=pr forge test -C src/highcountry/land --match-path test/highcountry/unit/land/LandRegistry.t.sol -vv
PATH=/tmp/foundry186:$PATH FOUNDRY_PROFILE=pr FOUNDRY_SOLC=/tmp/bounded-solc FOUNDRY_SCRIPT=/tmp/solidity-empty forge test -C /tmp/solidity-empty --match-path 'test/BetPoker{NLHEBetting,LiveCardReveals,NativeOutcome,Recovery}54.t.sol' -vv
```

The monolithic affected-test compile also reached the memory ceiling and was stopped before execution. [bounded-solc.py](evidence/hc-next-6.1-yul/bounded-solc.py) uses the identical native compiler and input/settings, requests all original outputs in smaller batches, verifies the complete output inventory and forwards the combined native results to Forge. The exact input and each batch are cached by SHA-256; any compiler error still fails the build. It does not alter bytecode, omit requested test contracts or replace test execution.

- LandRegistry: **6 passed, 0 failed, 0 skipped**, including `testOwnershipTransferPreservesOccupiedLeaseAndLivePlants`; [execution log](evidence/hc-next-6.1-yul/land-tests.log).
- Affected betting, live-card, native-outcome and recovery: **585 passed, 0 failed, 0 skipped, across 16 suites**; [execution log](evidence/hc-next-6.1-yul/poker-tests.log). All 37 test names defined directly in the four selected source files appear in execution, alongside the inherited adversarial regressions.
- [Compiler inventory manifest](evidence/hc-next-6.1-yul/compiler-manifest.json): all **215** requested contract outputs were returned across **69** bounded batches, from the same **125**-source input. Two independent native-output cache-preparation pairs (`python /tmp/prewarm-solc.py` and `python /tmp/prewarm-more.py`) completed under the identical input/selection hashes; [first orchestration](evidence/hc-next-6.1-yul/prewarm-solc.py) and [second orchestration](evidence/hc-next-6.1-yul/prewarm-more.py) are retained.
- [Qualification manifest and checksums](evidence/hc-next-6.1-yul/qualification-manifest.json) pins the implementation, source hashes, assertion preservation and exact execution counts.

## Retained evidence

The economy-service files are identical to the qualified original PR head, including after main reconciliation. Retain [High Country Land Leases run 40169905502](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/40169905502), job 121098459865, on `cb6f8e38ae6512fc51b0ff19a618e3c2fc6c58da`: canonical land/rent Level 1 **3/3 passed**, affected economy Level 2 **72/72 passed**, zero failures. No redundant economy, global, game or documentation execution is claimed or launched.

## Independent deployment-size blocker

These commands retain the default size enforcement and original compiler/profile settings. Separate output/cache directories isolate concurrent evidence collection:

```sh
PATH=/tmp/foundry186:$PATH FOUNDRY_PROFILE=pr FOUNDRY_TEST=/tmp/solidity-empty FOUNDRY_SCRIPT=/tmp/solidity-empty FOUNDRY_OUT=/tmp/land-size-out FOUNDRY_CACHE_PATH=/tmp/land-size-cache forge build -C /tmp/solidity-empty src/highcountry/land/LandRegistry.sol --sizes
PATH=/tmp/foundry186:$PATH FOUNDRY_PROFILE=pr FOUNDRY_TEST=/tmp/solidity-empty FOUNDRY_SCRIPT=/tmp/solidity-empty FOUNDRY_OUT=/tmp/fantasy-size-out FOUNDRY_CACHE_PATH=/tmp/fantasy-size-cache forge build -C /tmp/solidity-empty src/bet/fantasy/FantasyContestEngine420.sol --sizes
```

| Contract / graph | Runtime bytes | Initcode bytes | Result |
| --- | ---: | ---: | --- |
| LandRegistry, scoped native build | 6,850 | 7,205 | PASS |
| FantasyContestEngine420, scoped native build | 24,987 | 46,374 | FAIL: runtime 411 bytes over EIP-170 |
| FantasyContestEngine420, historical PR shard 2 | 25,032 | 46,349 | FAIL: runtime 456 bytes over EIP-170 |

See [land size log](evidence/hc-next-6.1-yul/land-size.log) and [fantasy size log](evidence/hc-next-6.1-yul/fantasy-size.log). The size failure is independently reproducible and its source is unchanged between the original PR and main. Neither runtime nor initcode limits were increased.

The [original Solidity workflow 40169905403](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/40169905403) has Yul failures in jobs 121099763644 (shard 0), 121099763648 (shard 1) and 121099763625 (shard 3). Job 121099763655 (shard 2) **compiled successfully**, then failed the size check before tests. It is inaccurate to describe all four shards as Yul compiler failures.

## Merge decision

PR #823 remains open and unmerged. The affected runtime qualification has completed successfully. The independent FantasyContestEngine420 size gate must still be resolved and qualified before merge. The Solidity workflow has not been declared green. Skip-CI markers on the reconciliation/evidence commits deliberately avoid unrelated automatic global/game/Docs reruns; the passing historical results are retained only for unchanged dependencies.
