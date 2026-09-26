# EXP-0.3.7 — bidirectional requirement/finding/milestone/acceptance traceability

**Status:** traceability ledger committed; exact-head CI qualification required before closeout.  
**Machine-readable ledger:** `docs/audit/EXP-0.3.7-bidirectional-traceability.json`.

## Objective

EXP-0.3.7 proves complete bidirectional traceability across the 420Explorer Genesis qualification model.

The forward direction is:

`requirement → implementation path → current finding/gap → remediation milestone → test path → acceptance criterion → required evidence`.

The reverse direction is:

`Genesis-blocking finding → affected requirement(s) → remediation milestone(s) → acceptance criterion(s) → required evidence`.

## Forward traceability

The ledger contains:

- **60 mandatory Genesis requirement traces**;
- **1 scope-decision trace** for the unresolved governance conflict;
- **0 orphaned mandatory requirements**.

Every mandatory requirement has:

- authoritative requirement identity;
- current status;
- concrete implementation path(s);
- later remediation/qualification owner(s);
- required-test path;
- one or more AC mappings;
- required evidence;
- evidence-source references.

The ten required views additionally trace to their dedicated:

- EXP-0.3.2 implementation-path ID;
- EXP-0.3.3 acceptance-test ID.

For non-view mandatory requirements, the required later test path is taken from the verification methods of the mapped acceptance criteria when no dedicated view-test record exists.

## Reverse blocker traceability

The register contains all **11 Genesis-blocking findings** from EXP-0.2.5:

- EXP-FIND-001 through EXP-FIND-011.

Every blocker has:

- one or more affected requirement IDs;
- one or more remediation milestones;
- its complete AC mapping;
- required evidence;
- a reciprocal reference back from every affected requirement.

There are **0 orphaned Genesis blockers**.

## AC-9 global trace

AC-9 is deliberately treated as a global release-candidate acceptance trace.

It verifies:

- exact release-candidate SHA;
- complete mandatory test inventory;
- exact workflow/command evidence;
- successful execution of all mandatory suites;
- explicit treatment of skipped/non-applicable tests;
- no unresolved regression.

It is not assigned to an arbitrary single requirement because its scope is the entire release candidate.

With this global trace, **AC-1 through AC-10 are all covered**.

## Governance trace

Governance remains traceable without being falsely resolved:

`EXP-FIND-001 → EXP-REQ-SCOPE-001 → EXP-0.3.8 → AC-5 / AC-10`.

This preserves the fail-closed behavior established in EXP-0.3.6.

## Qualification gate

`scripts/verify-exp-0-3-7-traceability.py` fails closed unless:

1. exactly 60 mandatory requirements are forward-traced;
2. exactly one scope-decision requirement is traced;
3. all 11 Genesis-blocking findings are reverse-traced;
4. no mandatory requirement is orphaned;
5. no Genesis blocker is orphaned;
6. every mandatory requirement has implementation paths, owners, AC mappings, required evidence, and a test path;
7. all required-view requirements map to matching EXP-0.3.2 and EXP-0.3.3 records;
8. every blocker→requirement reference is reciprocal;
9. every mapped requirement/finding/AC exists in the authoritative source artifacts;
10. every remediation milestone is a valid EXP milestone;
11. AC-1 through AC-10 are fully covered, with AC-9 represented by exactly one global trace;
12. governance remains routed to EXP-0.3.8 and unresolved;
13. traceability completeness is not represented as blocker resolution or AC satisfaction.

The verifier emits:

- `exp-0-3-7-evidence/summary.json`;
- `exp-0-3-7-evidence/requirement-traces.tsv`;
- `exp-0-3-7-evidence/blocker-traces.tsv`.

## Completion condition

EXP-0.3.7 is qualified when its dedicated verifier and all retained Explorer/Indexer/repository qualification gates pass on the same exact head and the evidence artifact is uploaded.

Qualification means the Genesis scope model is fully traceable in both directions. It does not mean the mapped blockers have been remediated or the acceptance criteria have been satisfied.
