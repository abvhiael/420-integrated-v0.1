# BET-AUDIT-4.7 — Mines V1 Level 1 qualification certificate

**Disposition: Level 1 PASS for locally executable audit scope; no live wagering or production approval.**

**Canonical roadmap step:** 4.7 Mines V1 — hidden mine placement, cell reveals, progressive multipliers, cash-out, explosions and settlement.

**Exact successfully tested implementation SHA:** `d61da65e983e7c391c942dc6dc299426d146dafc`.
**Audit PR:** [#689](https://github.com/abvhiael/420-integrated-v0.1/pull/689), branch `audit/420bet-mines-4-7-level1-20261016`.

## Exact-SHA evidence

| Workflow | Run | Result |
| --- | --- | --- |
| Mines Level 1 (12 mandatory suites) | [38991333841](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38991333841) | **PASS — 77 tests / 12 suites** |
| Solidity Contracts | [38991333861](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38991333861) | PASS |
| Dice Client | [38991333825](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38991333825) | PASS |
| Keno Level 1 | [38991333920](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38991333920) | PASS |
| Roulette Level 1 | [38991333914](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38991333914) | PASS |
| Plinko Level 1 | [38991333822](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38991333822) | PASS |
| Blackjack Level 1 | [38991333820](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38991333820) | PASS |
| ReferenceSlot Level 1 | [38991333832](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38991333832) | PASS |
| 420Oracle qualification | [38991333852](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38991333852) | PASS |
| Global Level 3 artifact preflight | [38991333883](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38991333883) | PASS (preflight only; not Level 3 qualification) |
| Docs qualification | [38991333891](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38991333891) | SKIPPED, not PASS |

Mines job `117274165115` confirms `Qualified input SHA: d61da65e983e7c391c942dc6dc299426d146dafc` and `Executed 77 tests across 12/12 mandatory suites`.

Prior failing run `38987885068` was diagnosed as a **test-side player impersonation defect**, where an external salt getter consumed `vm.prank(PLAYER)` before reveal. The corrective commit moved salt/proof computation before impersonation; the tests and authorization checks were not weakened. Failed runs remain failed and are not cited as qualifications.

## Implementation and boundaries

- `MinesV1420`: 25-cell game with 1–24 mines, pre-randomness seed commitment, canonical root+seed deterministic mine mask with exact mine count, hidden salted Merkle leaf proofs, progressive safe reveals, mine explosion terminal loss, terminal cash-out and post-terminal board certification. Completion of independent seed-and-board verification is required before funds settle.
- `WagerRouter420`: governance-bound immutable Mines resolver and exact canonical parameters plus maximum gross liability before stake, nonce or reservation effects; generic Mines wager route rejected.
- `SettlementEngine420`: governance-bound Mines resolver; only verified terminal game state determines payout; caller-selected generic Mines settlement rejected.
- `MinesSettlementAdapter420`: forwards through canonical `settleMines` and retains terminal consistency assertions.
- `contracts/test/BetMinesHardening420.t.sol`, `contracts/test/BetMinesSettlementAdapter420.t.sol`: exact mine-count/proof, invalid seed, counterfeit board, caller impersonation and settlement regression.
- `.github/workflows/420bet-mines-level1.yml`: exact-SHA 12-suite inventory, Foundry failure visibility.
- `docs/420BET-TESTNET-WORK-ROADMAP.md`: independent economics, RTP/distribution and live seed/board/settlement acceptance.

## Reconciliation and limitations

Before this certificate commit, branch was 11 commits ahead and 3 behind then-current `main`. The intervening `main` file differences concerned Budtender Phase 3.16 assets, client, tests and tools exclusively, without overlap against any Mines executable qualification inputs. The evidence-only certificate commit must be separately checked to affect no executable source, workflows or test inputs before inherited exact-SHA qualification can be relied upon; preserve completed evidence rather than rerun unaffected suites.

**Level 2:** not requested as an ordinary step. **Level 3:** not initiated. **External acceptance:** approved legal/jurisdictional and operator policies, independent fairness/math and bankroll sign-off, real deployed VRF provider and board commitments, funded cash-out/explosion/expiry and provider-withholding recovery receipt evidence, release controls and production authorization remain deferred to the canonical testnet work roadmap.

**Merge status:** requires final PR eligibility and resulting main-tree verification. **Next canonical step:** consult repository roadmap after closing 4.7.
