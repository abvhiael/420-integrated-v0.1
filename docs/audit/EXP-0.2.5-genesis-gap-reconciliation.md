# EXP-0.2.5 — Genesis blocker and qualification-gap register

**Status:** formal gap register committed; exact-head CI qualification required before closeout.  
**Machine-readable register:** `docs/audit/EXP-0.2.5-genesis-gap-register.json`.

## Objective

EXP-0.2.5 converts the verified findings from EXP-0.2.1 through EXP-0.2.4 into the formal Genesis gap analysis required by the originating Explorer audit.

The register uses the audit's six classifications exactly:

- **Genesis blocker** — a required capability, dependency, security control, or operational guarantee that is absent or demonstrably defective.
- **Qualification gap** — an implemented capability that lacks sufficient evidence, testing, or verification.
- **Integration gap** — a missing or incomplete connection to an independently required Genesis component.
- **Documentation gap** — missing, inaccurate, obsolete, or incomplete documentation.
- **Operational risk** — an infrastructure, reliability, performance, or recovery concern requiring qualification.
- **Post-Genesis enhancement** — a desirable capability that is not required for the agreed Genesis scope.

Every finding includes a unique ID, severity, exact affected paths/components, evidence, root cause where established, consequences, dependencies/prerequisites, required remediation, tests, later milestone owner, acceptance-criterion references, and explicit Genesis-blocking rationale.

## Register summary

The current register contains 14 findings:

- 3 Genesis blockers;
- 3 qualification gaps;
- 3 integration gaps;
- 1 documentation gap;
- 1 operational risk;
- 3 post-Genesis enhancements.

### Confirmed implementation blockers

The blocker set is intentionally narrow and grounded in EXP-0.2.2 rather than mature-explorer wish-list features:

1. **EXP-FIND-008 — transaction fee inspection incomplete.** The Explorer exposes gas used but not effective gas price or an actual fee value.
2. **EXP-FIND-009 — historical validator-produced block attribution absent.** Current block records cannot be traced to the historical proposer/validator.
3. **EXP-FIND-010 — raw event inspection incomplete.** The UI does not expose full topic values and log data for complete raw event review.

### Required qualification/deployment gaps

- **EXP-FIND-002** — no qualified deployed 420Indexer testnet endpoint;
- **EXP-FIND-003** — Explorer backend/frontend remain undeployed and live-unqualified;
- **EXP-FIND-004** — official canonical RPC/node binding remains unverified.

These are not labeled source failures. Their source paths exist; the missing evidence is deployment/runtime qualification.

### Required integration gaps

- **EXP-FIND-005** — ProtocolRegistry target-network code/publication not qualified;
- **EXP-FIND-006** — Registry ABI/descriptor runtime provenance not qualified;
- **EXP-FIND-007** — deployed consensus/validator provider wiring not qualified.

### Scope/documentation gap

**EXP-FIND-001** preserves the governance-view ambiguity first recorded in EXP-0.2.1. It blocks final EXP-0/Genesis scope closeout until an authoritative decision is recorded, but the register does not silently assume that governance display is already mandatory.

### Operational risk

**EXP-FIND-011** records the absence of production-equivalent evidence for deployed restart/resume, RPC outage, lag, stale state, live reorg repair and related fail-closed behavior. Existing source tests remain valid evidence for implementation, but they do not substitute for deployment qualification.

### Explicit non-blockers

The following are intentionally recorded as post-Genesis enhancements rather than speculative blockers:

- staking/reward-specific Explorer activity;
- 420 Names / 420 Identity label enrichment;
- verified-source / 420 Verify presentation integration.

Their absence does not block the agreed core Explorer Genesis profile.

## Blocking semantics

A finding may be marked `genesis_blocking: true` only when one of these conditions holds:

1. it maps to an agreed mandatory capability or user workflow;
2. it is a mandatory shared dependency required by those capabilities;
3. it is required to resolve final Genesis scope;
4. it is an explicit operational acceptance condition for Genesis.

Optional enrichment absence may never satisfy those conditions.

The register also preserves the audit rule that **unverified is not failed**. Lack of live evidence is represented as a qualification/integration/operational gap unless the repository proves the implementation itself absent or defective.

## Automated qualification gate

`scripts/verify-exp-0-2-5-genesis-gaps.py` fails closed unless:

1. all 14 expected findings exist exactly once;
2. every finding uses one of the six audit classifications;
3. every finding has severity, affected components, evidence, root cause, consequences, dependencies, prerequisites, remediation, tests, owner and blocker rationale;
4. every referenced repository path exists;
5. the three EXP-0.2.2 implementation gaps remain represented as Genesis blockers;
6. governance ambiguity remains a documentation/scope blocker until authoritative sources agree;
7. mandatory undeployed dependencies remain qualification/integration gaps rather than being claimed live;
8. Names/Identity/Verify and staking/reward enhancement findings remain non-blocking;
9. post-Genesis findings have no Genesis acceptance criteria assigned;
10. no finding marks optional display enrichment absence as a core Genesis blocker;
11. the classification counts match the checked-in register;
12. the no-speculative-blocker and unverified-not-failed rules remain present.

The verifier writes `exp-0-2-5-evidence/summary.json` and `findings.tsv`.

## Completion condition

EXP-0.2.5 is qualified when its dedicated verifier, the Explorer/Indexer regression suite, documentation qualification, and repository-wide qualification all pass on the same exact PR head and the evidence artifact is uploaded.

This milestone qualifies the **gap register and classification discipline**. It does not remediate the findings themselves.
