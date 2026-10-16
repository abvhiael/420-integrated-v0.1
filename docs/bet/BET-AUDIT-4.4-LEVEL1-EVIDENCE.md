# BET-AUDIT-4.4 — Level 1 exact-SHA qualification evidence and deferred external gates

**Qualification status: PENDING final exact-SHA ReferenceSlot suite.** This is a durable evidence record, **not** a premature Level 1 PASS certificate. Replace status only after verifying the final required run outcome and tested SHA.

## Scope

Canonical BET-AUDIT-4.4 — reel definitions, symbols, ways/payline semantics, random streams, paytables, RTP artifacts, liability ceilings, canonical wager admission and settlement. Level 1 ordinary app step; no phase-wide Level 3 qualification requested.

**Implementation SHA:** `dc1768e1a4404acd44fea31cbc99397ee0fef685`. The subsequent evidence-only commit must be recorded separately. **PR:** [#678](https://github.com/abvhiael/420-integrated-v0.1/pull/678), `audit/420bet-reference-slots-4-4-level1-20261016`.

## Engineering evidence

- Earlier verified executable implementation `7402312984efae34da66ad51f5327967f02f1c17`: [ReferenceSlot Level 1 run 38930031457](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38930031457), **58 tests in 13/13 suites**. This evidence is historical; it must NOT be described as executing later source/tests.
- Current implementation includes independently reconstructed integer base-screen and free-spin feature outcomes across 48 deterministic root candidates, including stops, scatter count versus scatter reels, ways, capped terminal category, retriggers, 2x feature multiplier and liability-bound acceptance.
- Current exact-SHA run: [ReferenceSlot Level 1 38946733950](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946733950), **PENDING as of certificate draft**. Final PASS is conditional on this result.
- Current exact-SHA [Solidity Contracts 38946733917](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946733917): **PASS**; [integer modeling 38946734190](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946734190): **PASS**; [RTP audit 38946734261](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946734261): **PASS**; [research candidate 38946734043](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38946734043): **PASS**. These qualify the named code/test verifiers and simulation, not production RTP policy.
- Docs was skipped. An automatically triggered global Level 3 artifact preflight failed, but global Level 3 was **not** requested as ordinary Level 1; investigate before eventual phase closeout and never describe it as passing.
- Scope of passing evidence must be verified per exact SHA and unaffected source paths before any main reconciliation or merge. Earlier six green suite runs remain historical evidence only.

## External release gates — intentionally deferred

See `docs/420BET-TESTNET-WORK-ROADMAP.md`. Reference Slots needs **independent RTP target approval**, a **signed independent cap-aware mathematical review and production-denomination certificate**, **separate bankroll risk sign-off and funded reserve**, **approved reel/paytable/RTP/liability artifact digests**, and **real deployment/chain/runtime-code hash, wager settlement and randomness proofs**. Research estimate 92.996787% at 1/80 scale over 25,000 simulated wagers is NOT authorized production RTP or exact analytical proof. Production activation remains disabled.

**Merge disposition:** draft/unmerged pending final scoped test, production-gate separation, current-main divergence impact review, and applicable repository policy.
