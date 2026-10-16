# BET-AUDIT-4.4 — Level 1 qualification certificate

**Disposition: LEVEL 1 PASS — executable/local audit scope.** This certificate does **not** grant production-game activation, independently certified production RTP, or authorized bankroll deployment.

**Canonical step:** BET-AUDIT-4.4 — Reference Slots V1: reel definitions, symbols, ways/payline semantics, deterministic random streams, paytables, RTP research artifacts, maximum liability, safeguarded wager acceptance and canonical settlement.

**Level:** 1 (ordinary app-audit step; not phase closeout).

**Exact tested SHA:** `e482161dfd1965e60ba11d90da0941097c474470`.

**Branch / PR:** `audit/420bet-reference-slots-4-4-level1-20261016`, [PR #678](https://github.com/abvhiael/420-integrated-v0.1/pull/678).

**Reconciliation base:** `9213de7cab9ebcfa2735850b0ecd897ee44fe6af` (PR base at implementation); current `main` has since advanced, so final merge reconciliation and impact review remain **NOT COMPLETE**. The branch was 26 commits ahead / 32 behind as of certificate issuance. GitHub merge eligibility must be verified separately; this certificate does not claim merge readiness.

## Verified exact-SHA checks

All runs below were confirmed **completed with conclusion success** at `e482161dfd1965e60ba11d90da0941097c474470`; no success is borrowed from an unrelated SHA.

| Workflow | Run | Actual result |
|---|---|---|
| 420Bet ReferenceSlot Level 1 | [38946890745](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946890745) | **PASS** — **59 tests / 13 of 13 mandatory suites**; job `117129817685` |
| Solidity Contracts | [38946890830](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946890830) | **PASS** |
| 420Bet Reference Slot Integer Math | [38946890791](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946890791) | **PASS** |
| 420Bet Reference Slot RTP Audit | [38946890841](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946890841) | **PASS** |
| 420Bet Reference Slot Economic Candidate | [38946890859](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946890859) | **PASS** |
| 420Bet Dice Client | [38946890876](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946890876) | **PASS** |
| 420Oracle audit qualification | [38946890849](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946890849) | **PASS** |
| 420Bet Keno Level 1 | [38946890931](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946890931) | **PASS** |
| 420Bet Plinko Level 1 | [38946890891](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946890891) | **PASS** |

The qualifying Reference Slots job log explicitly states:
```
Qualified input SHA: e482161dfd1965e60ba11d90da0941097c474470
Executed 59 tests across 13/13 mandatory suites
```

**Other automatically triggered workflows:** 420Docs [38946890854](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946890854) was **SKIPPED**, not a PASS. Global Level 3 Artifact Preflight [38946890776](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946890776) **FAILED**. This Level 1 certificate neither requires nor asserts a global Level 3 closeout, and the failed global preflight must be remedied before that separate qualification boundary. No global rerun was manually dispatched for this certificate.

## Qualified local engineering scope

- Deterministic canonical reel stop stream, five reels of 32 symbols each, four visible rows, seven symbol types, scatter awards versus feature triggers, ways-to-win rather than fixed paylines.
- Full immutable wager-term hash, game-version/ruleset binding, registered reel/paytable/RTP/liability artifact commitments and authority-gated acceptance before escrow, nonce and reserve mutations.
- Canonical resolver-based settlement (generic caller-selected slot outcome/gross payout rejected).
- Integer payout screening, deterministic feature/retrigger replay, independently reconstructed base/feature awards across 48 seeded roots, terminal classification and gross payout cap/bankroll liability assertions.
- Seeded RTP research and a cryptographic multi-reviewer approval verifier. **Passing statistical/model scripts does not imply independent mathematical certification.**

## Research evidence — not an approved RTP

The **1/80-scale float-based research candidate** produced an estimated **92.996787% RTP** from 25,000 sampled wagers in [run 38942986984](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38942986984). Integer-denominated candidate calculations also have dedicated passing CI, but no exact analytically derived production RTP or approved stake-specific real-money paytable is claimed. Fixture max gross and reserved net liability at a 100-unit stake are 5,000 and 4,900 units, respectively; these are **test terms**, not authorized live limits.

## Deferred independent release gates

The dedicated ledger `docs/420BET-TESTNET-WORK-ROADMAP.md` retains these **PENDING** requirements: independently approved RTP target/tolerance, mathematically certified deployed-rule-equivalent RTP calculation, separate funded bankroll-risk approval, approved signed artifact hashes and reviewer-key registry, jurisdiction/operator permissions, testnet code/manifest/contract-address verification, and live randomness-to-settlement/asset-conservation evidence. Production activation is prohibited until authorized independently. No reviewer approval or signature was fabricated.

**Level 2:** Not required for this ordinary step. **Level 3:** Not started; global artifact preflight is unresolved.

**Evidence-only commit:** The commit adding this finalized certificate changes only documentation; record its separate SHA from the GitHub commit response. Its presence does not imply that CI ran against that documentation commit. Previously successful exact-SHA evidence is preserved without new qualification dispatch.

**Merge eligibility:** Pending reconciliation and impact assessment of newer `main` changes. **Next canonical audit step:** BET-AUDIT-4.5 after step closure and repository-policy merge decisions.
