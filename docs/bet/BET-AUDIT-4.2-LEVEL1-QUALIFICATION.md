# 420Bet BET-AUDIT-4.2 — Level 1 qualification certificate

**Scope:** Keno V1 game engine, version-bound paytable verifier, fail-closed wager acceptance, deterministic resolver-backed settlement, bankroll liability, and applicable Dice Client integration.

**Executable qualification SHA:** `912322604c443fc7013105f2eb61614191ed174b`

## Exact-SHA CI evidence

- Keno Level 1: [run 38920306929](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38920306929) — **PASS**, 64 tests, 12/12 mandatory suites, explicit checkout of the exact implementation SHA.
- Keno Paytable Math: [run 38920306597](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38920306597) — **PASS**.
- Dice Client: [run 38920306828](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38920306828) — **PASS**, including real Anvil deployment smoke and production bundle.
- Solidity Contracts: [run 38920306740](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38920306740) — **PASS** (automatically triggered; not an additional manual global run).
- Oracle Audit: [run 38920306942](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38920306942) — **PASS** (automatically triggered).

## Main reconciliation basis

Compared PR branch to current `main` before certification: branch 19 commits ahead and 170 commits behind, common ancestor `9fce5444bd009efe382a6874c0a5259498457454`. The intervening main file inventory did not list affected Keno contracts, Keno tests, Keno qualification workflows, or Dice Client smoke files. GitHub marked PR #668 mergeable. The GitHub merge commit is a distinct SHA; no assertion is made that the above CI ran on that future merge commit.

## Approval and deployment boundaries

This certifies the **tested implementation** of the Keno verifier, acceptance, and settlement. The repository's `420bet-keno-v1-paytable-candidate.json` remains an economic **candidate** with an explicitly missing independent approval/reference and approved digest. No production authorization, on-chain schedule activation, Genesis bankroll transfer, gambling license, or testnet/live readiness is asserted. These remain fail-closed release gates.

**Level:** 1 (ordinary canonical BET-AUDIT-4.2 step). No Level 2/3 or repeat global qualification is implied.

**Change-type inheritance:** this certificate is evidence-only; it does not modify qualified executable or test inputs.
