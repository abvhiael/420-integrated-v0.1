# CMP-1.3.4 — 420Trust reputation references and policy-scoped admission

Status: **CANDIDATE QUALIFIED; final evidence-recording head qualification pending.**

CMP-1.3.4 integrates ComputeWorkerRegistry with canonical 420Trust evidence without creating a universal reputation score or a second reputation ledger.

## Source authority

The canonical Trust surface is `ITrust420.readMetric(subjectType, subjectId, metricId)`. It returns one metric at a time:

- domain ID;
- unit ID;
- metric revision;
- active/inactive state;
- aggregate total;
- active-signal count.

The interface explicitly states that no universal trust score exists in V1. CMP-1.3.4 preserves that rule.

## Scope

This step adds `ComputeWorkerTrust420` with:

- governance-versioned, policy-specific worker reputation predicates;
- one explicit Trust subject type and metric per policy;
- exact expected metric domain and unit;
- minimum aggregate total and minimum active-signal count;
- live fail-closed reads from the configured canonical `ITrust420` source;
- immutable reputation references bound to:
  - worker ID;
  - exact worker revision;
  - policy ID and policy revision;
  - Trust metric revision;
  - aggregate total;
  - active-signal count;
  - a domain-separated metric snapshot commitment;
- optional reference-required admission for workflows that need reconstructable reputation evidence;
- current-live-state enforcement even when a historical reference exists.

## Trust and authority boundary

Reputation is evidence, not authority.

A reputation policy/reference cannot:

- certify job correctness;
- move or reserve Vault funds;
- settle or refund a job;
- select or accept a match;
- grant verifier authority;
- create or satisfy compute stake;
- slash or reward stake;
- alter worker/provider/node/resource lifecycle;
- grant governance, bridge, validator, or wallet authority.

A favorable historical reference cannot override corrected/revoked live Trust evidence for new admission.

## No universal score

CMP-1.3.4 does not sum unrelated metrics or define a protocol-wide worker score.

Each policy explicitly selects a single metric with fixed domain/unit semantics. Different clients or job policies may select different qualified metrics without one derived value becoming canonical protocol reputation.

## Fail-closed behavior

New admission fails if:

- the worker revision is not currently eligible;
- the reputation policy is missing or not accepting new work;
- the Trust metric is inactive;
- metric domain or unit differs from the policy;
- aggregate total is below the policy minimum;
- active-signal count is below the policy minimum;
- a required reputation reference is missing;
- the reference belongs to another worker/revision;
- the reference belongs to an older policy revision.

Historical references remain readable after Trust corrections or policy supersession.

## Qualification tests

`contracts/test/ComputeWorkerTrust420.t.sol` covers:

1. policy-scoped live Trust metric admission without a universal score;
2. exact worker/revision/policy/metric snapshot binding;
3. total and active-signal thresholds;
4. inactive metric rejection;
5. domain and unit semantic mismatch rejection;
6. live Trust correction removing future eligibility without rewriting history;
7. policy supersession invalidating old references for new admission;
8. worker-revision changes invalidating old references;
9. unauthorized reference capture and policy mutation rejection;
10. parent/resource suspension overriding favorable reputation;
11. reputation references granting no worker lifecycle authority.

## Invariant mapping

CMP-1.3.4 directly advances:

- CMP-INV-002/003 — references bind stable worker identity and exact revision;
- CMP-INV-005 — reputation references grant no unrelated authority;
- CMP-INV-019 — one worker/revision cannot consume another's reference;
- CMP-INV-020 — reputation admission state does not confiscate historical settlement;
- CMP-INV-021/022 — reputation cannot substitute for stake/slash authority;
- CMP-INV-023 — Trust evidence remains separate from authority;
- CMP-INV-026 — historical reputation state can be reconstructed;
- CMP-INV-028/029 — policy/metric/revision changes cannot silently preserve old admission semantics;
- CMP-INV-030 — policy-scoped metrics remain provider-neutral and general-purpose.

## Deferred boundaries

CMP-1.3.4 does not implement:

- CMP-1.5 compute collateral references;
- accepted-job worker snapshot integration;
- deployment and ProtocolRegistry publication.

Those remain later CMP-1.3 slices.

## Completion gate

CMP-1.3.4 is complete only after the exact candidate head passes:

- Solidity Contracts qualification, all required shards;
- 420 Integrated Qualification;
- 420Docs Qualification.

The exact candidate SHA and run evidence must then be recorded, followed by retained exact-head qualification of the evidence-recording head before final closeout.


## Candidate qualification evidence

Candidate exact head:

`67195b992f7793ac8012af130085bcf0902c23d4`

Repository qualification on that exact candidate head:

- Solidity Contracts #3241 — run `36366864365` — **SUCCESS**, all 16 PR shards passed;
- 420 Integrated Qualification #5785 — run `36366864488` — **SUCCESS**, including offline-core, production-dependencies, fault-matrix, and geth-engine;
- 420Docs Qualification #3168 — run `36366864345` — **SUCCESS**.

This qualifies the executable CMP-1.3.4 candidate. The documentation update recording that evidence creates a distinct final evidence-recording head; applicable retained exact-head qualification must pass on that new head before CMP-1.3.4 is marked COMPLETE.
