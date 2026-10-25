# HC-NEXT-6.1 — production size gate closeout

Status: **PASS — applicable scoped merge gates satisfied**. This closes the independent production-size blocker recorded in the [Yul qualification](HC-NEXT-6.1-YUL-QUALIFICATION.md). No repository-wide CI/phase-closeout claim is made.

Implementation SHA: `25678fff5e7f5d94477d5d122b7d085148dc6861`. Base evidence head: `2281b7cabaa3d77a2aa2842edf12a365f76fa9a7`. Reconciled main: `1995edc3df97359570e403cc6ab2999928198b33`. Subsequent documentation/evidence-only commits inherit this implementation.

## Production-neutral reduction

The contest host's CREATE, INVITE and CONFLICT checks now use its existing admission module. The module receives and freezes the engine's original immutable authorization address at construction; it does not select host authority through a later slate getter. Actor, action, canonical global/contest scope, zero amount and the Unauthorized() rejection selector are unchanged. The engine's external ABI is unchanged; the internally created admission child takes one additional constructor argument for this binding.

The existing exact 3% quotient/remainder formula is unchanged. Its unreachable overflow checks are removed with an explicit proof: for `g = 100q + r`, `3q` and `3r` cannot overflow uint256, `0 <= r < 100`, and `3q + floor(3r/100) = floor(3g/100) <= g`. The net-prize subtraction therefore cannot underflow. Custody, credit, transfer, nonce and reentrancy checks remain checked and unchanged.

One new end-to-end boundary test funds a two-entrant pool with gross `uint256.max - 1`, settles it, validates the exact independent 3% constant and collects conserved credits. All existing fantasy tests and assertions are retained. No failed assertions or adversarial cases were disabled.

## Native compiler and deployment gates

Foundry 1.8.6 and native Solc 0.8.24; original PR profile, Cancun, optimizer 200 and via-IR remain unchanged. EIP-170 and initcode enforcement remain enabled. No optimizer/profile/limit override bypasses the gate.

| Dependency graph | Engine runtime | Engine initcode | Admission runtime | Result |
| --- | ---: | ---: | ---: | --- |
| Scoped production graph | 24,429 | 46,407 | 5,331 | PASS |
| Shard 0 | — | — | — | Changed deployables absent from this graph |
| Shard 1 | 24,474 | 46,382 | 5,331 | PASS |
| Shard 2 | 24,429 | 46,407 | 5,331 | PASS |
| Shard 3 | 24,429 | 46,407 | 5,331 | PASS |

The largest runtime is 102 bytes below 24,576. Admission initcode is 5,644 bytes; all initcode is below 49,152. Exact captured graph hashes, settings and sizes are retained in the [context results](evidence/hc-next-6.1-size-closeout/shard-size-contexts.jsonl) and [native size output](evidence/hc-next-6.1-size-closeout/production-sizes.log). These are deployable-specific compilations of the actual shard source graphs, not claims that every shard's tests were rerun.

```sh
# From contracts/; PATH includes /tmp/foundry186.
FOUNDRY_PROFILE=pr FOUNDRY_TEST=/tmp/solidity-empty FOUNDRY_SCRIPT=/tmp/solidity-empty FOUNDRY_OUT=/tmp/fantasy-size-out FOUNDRY_CACHE_PATH=/tmp/fantasy-size-cache forge build -C /tmp/solidity-empty src/bet/fantasy/FantasyContestEngine420.sol --sizes
FOUNDRY_PROFILE=pr FOUNDRY_SOLC=/tmp/bounded-solc FOUNDRY_SCRIPT=/tmp/solidity-empty FOUNDRY_OUT=/tmp/fantasy-qualification-out FOUNDRY_CACHE_PATH=/tmp/fantasy-qualification-cache forge test -C /tmp/solidity-empty --match-path 'test/fantasy/Fantasy{ContestEngine,SlatePublication,MixedGames}420.t.sol' -vv
python /tmp/qualify-fantasy-size-contexts.py
```

Cold shard input capture used the unmodified `scripts/qualify-foundry-shard.sh N 4`, `FOUNDRY_PROFILE=pr`, a fresh out/cache per shard, `FOUNDRY_SOLC=/tmp/capture-size-solc` and `CAPTURE_OUTPUT=/tmp/fantasy-shardN-input.json`. Capture intentionally exits after collecting native compiler input, before any test execution. The [size orchestration](evidence/hc-next-6.1-size-closeout/qualify-size-contexts.py) recompiles only the changed deployables, preserving each source graph and compiler settings. Matching completed size results are reused by input SHA-256.

## Runtime qualification and retained evidence

**80 tests passed across three suites, zero failed and zero skipped.** This includes 2,500 fuzz runs for ranking payout conservation and the new full-width fee/conservation boundary, plus existing creation authority, revocation, forged signatures, custody, dispute, development forwarding, callback/reentrancy and token-delta cases. The existing sixteen-million-gas constructor test passes. [Full execution output](evidence/hc-next-6.1-size-closeout/fantasy-qualification.log).

The engine ABI comparison is [unchanged](evidence/hc-next-6.1-size-closeout/abi-comparison.json). ABI entry ordering is normalized; no function, event, error or engine constructor entry was added, removed or changed.

Retain **585 poker tests and six LandRegistry tests** from the previous implementation. The three changed fantasy paths lie outside the complete 55-source Solidity import closure of those selected tests; [dependency hashes](evidence/hc-next-6.1-size-closeout/retained-evidence.json) record that boundary. Retain economy Level 1 **3/3** and Level 2 **72/72** from Actions run **40169905502** on `cb6f8e38ae6512fc51b0ff19a618e3c2fc6c58da`; no economy-service file changed.

[Qualification manifest](evidence/hc-next-6.1-size-closeout/qualification-manifest.json) records the source hashes, original test/assertion preservation, coverage counts and evidence checksums. No unrelated global, game, documentation or Genesis qualification workflow was launched. Skip-CI markers deliberately preserve that execution boundary; these local scoped results are not represented as a fresh all-green GitHub Actions run.

## Reconciliation

The Yul compiler fix, land protections, exact API behavior, scoped fantasy regression and all applicable deployment-size gates are reconciled. PR #823 is eligible for the requested merge using this implementation and inherited evidence. The resulting merge SHA is recorded in PR metadata.
