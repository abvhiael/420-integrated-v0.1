# EXP-0.4.5 — acceptance-criterion evidence reconciliation

**Status:** qualified at repository scope; final evidence-recording head requalification required.

## Purpose

EXP-0.4.5 makes the evidence state for AC-1 through AC-10 explicit. It joins the authoritative acceptance map to the current Genesis blocker register, the 60 mandatory requirements, the exact-head provenance ledger and the requirement-to-CI coverage ledger.

## Current result

All **10 acceptance criteria remain unverified**. This is expected and correct at EXP-0.

The ledger records, for every AC:

- the primary and supporting milestone owners;
- the evidence layers those owners must supply;
- every mandatory requirement mapped to the criterion;
- every current Genesis blocker mapped to the criterion;
- current repository/source evidence that exists today;
- every release/runtime/deployment/live evidence item still missing or not yet qualified;
- the fail-closed satisfaction rule.

AC-9 and AC-10 have no individual blocker IDs in the current gap register, but they remain unverified because they depend on the exact release candidate, complete mandatory suite execution, AC-1 through AC-9 evidence, and final closeout.

## Evidence boundary

The retained EXP-0 exact-head runs prove repository/source and integration qualification for their recorded scope. They do **not** satisfy runtime, deployment, live-network or release-candidate evidence requirements.

Accordingly this milestone does not mark any acceptance criterion satisfied and does not reduce the current count of ten Genesis blockers.

## Qualification condition

EXP-0.4.5 is qualified only when the verifier proves:

1. exactly AC-1 through AC-10 are present;
2. statuses, owners, verification methods and required evidence exactly match EXP-0.2.6;
3. blocker mappings exactly match the active Genesis blocker register;
4. mandatory requirement mappings exactly match EXP-0.4.4;
5. all referenced test/verifier paths exist;
6. all ten criteria remain unsatisfied/unverified at the current audit stage;
7. no criterion is orphaned;
8. repository evidence is explicitly scoped below runtime/deployment/live/Genesis evidence.


## Exact-head implementation qualification

Qualified implementation head: `9a694d5d000dc2e295569d291bf3753c40555b94`

- 420Indexer #627 — run `36284316348`, job `108522044299` — success.
- 420Docs Qualification #2955 — run `36284316363`, job `108522060810` — success.
- 420 Integrated Qualification #5572 — run `36284316378` — success.
  - fault matrix `108522158307` — success.
  - offline core `108522158410` — success.
  - pinned-Geth Engine `108522158457` — success.
  - production dependencies `108522158486` — success.
- EXP-0.4.5 artifact `10920122006`.
- Digest `sha256:b2dc17bf9f64fa5f48b05e42b3914ba4db197371025f77f760871b314e135374`.

The implementation head therefore qualifies the AC evidence reconciliation at repository scope. This evidence recording changes the branch SHA, so a final exact-head rerun is required before EXP-0.4.5 is marked COMPLETE.
