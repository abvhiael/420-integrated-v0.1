# CMP-2.7 — Market adversarial qualification

Status: **COMPLETE — Level 1 + Level 2 exact-head qualified on `c20d14a06c0787ac76f58b925d94b1625969105b`.**

Durable evidence: [CMP-2.7 qualification](CMP-2.7-QUALIFICATION-EVIDENCE.md).

## Canonical scope

CMP-2.7 is the hostile qualification boundary for the accumulated CMP-2 marketplace before phase closeout.

It does not create a new market authority or broaden any role. It adversarially exercises the already implemented request, offer, matching, pricing, scheduler and capacity-assignment boundaries.

## Gap analysis

The repository already contained strong component-level negative tests, but the market phase lacked one durable threat matrix tying those checks together and lacked explicit hostile sequencing for four cases:

- outsider acceptance followed by legitimate owner recovery;
- resurrection of a cancelled request through an already-created proposal;
- provider settlement-account drift after match acceptance;
- metered pricing multiplication overflow.

CMP-2.7 adds those cases without changing production contracts.

## Threat campaign

The campaign covers:

- requester authorization replay, malformed terms and stale delegation;
- offer authority scope violations and resource drift;
- stale request/offer/resource revisions;
- outsider or scheduler acceptance attempts;
- terminal request resurrection and duplicate acceptance;
- fixed and variable price overbid, bounds, rounding and multiplication overflow;
- provider/beneficiary drift after accepted economics are frozen;
- scheduler outage, replacement and competing-scheduler races;
- capacity oversubscription and partial-mutation resistance.

Every hostile rejection must preserve the relevant canonical state: no unauthorized accepted match, no extra proposal allocation where proposal construction itself fails, no rewritten beneficiary/resource snapshot, and no stranded capacity reservation.

## Level 1 qualification

Level 1 requires on one exact implementation SHA:

1. Compute contracts compile;
2. all new CMP-2.7 hostile tests pass;
3. mapped retained request/offer/matching/capacity negative tests remain present;
4. the CMP-2.7 mechanical threat-matrix verifier passes;
5. focused Compute Market and app-scoped Solidity qualification pass.

## Level 2 milestone

CMP-2.7 is the **CMP-2 accumulated market adversarial integration** milestone.

Because the threat campaign spans request authorization, offer authority, matching, pricing, scheduler replacement, provider/resource immutability and capacity admission, the retained full `Compute*.t.sol` app integration suite must pass on the same exact implementation SHA.

This is not Level 3 repository-wide closeout.

## Limitations and deferred work

CMP-2.7 does not claim live deployment, funded testnet behavior, public worker execution, ProtocolRegistry publication, production external audit, or repository-wide closeout.

Those broader checks are not required to complete this adversarial market step. CMP-2.8 remains the canonical Level 3 phase-closeout boundary.

## Completion gate

CMP-2.7 is COMPLETE only when:

- every threat-matrix row resolves to executable tests;
- the four newly strengthened hostile cases pass;
- retained Compute Market tests are green;
- CMP-2.7 verifier passes;
- exact-head Compute Market Qualification and app-scoped Solidity qualification are green;
- Level 2 retained app integration passes on that same implementation SHA.

All completion gates passed on `c20d14a06c0787ac76f58b925d94b1625969105b`.

## Qualification evidence

- Compute Market Qualification #202 — run `37177056717`, job `111361804776` — **SUCCESS**
  - retained Compute Market Solidity suite: **70 suites / 470 tests passed / 0 failed / 0 skipped**
  - CMP-2.7 mechanical verifier: **PASS**
  - affected SDK build: **PASS**
  - affected SDK tests: **24/24 passed**
- Solidity Contracts #4641 — run `37177056715` — **SUCCESS**
  - classify-pr job `111361805106` — **SUCCESS**
  - compute-fast job `111362665371` — **SUCCESS**
  - retained Compute Market Solidity suite: **70 suites / 470 tests passed / 0 failed / 0 skipped**
  - repository-wide Foundry and PR shards were skipped as intended for this app-scoped Level 2 milestone

Level 3 repository-wide phase closeout remains intentionally deferred to CMP-2.8.

## Completion

**CMP-2.7 COMPLETE.**

Next canonical roadmap step: **CMP-2.8 — Phase closeout**.
