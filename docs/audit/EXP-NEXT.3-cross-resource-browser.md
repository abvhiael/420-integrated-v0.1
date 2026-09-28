# EXP-NEXT.3 — Consensus/producer and cross-resource browser workflow closeout

Status: **IMPLEMENTED_PENDING_EXACT_HEAD_QUALIFICATION**

Canonical definition: `docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json`.

This step closes repository-side browser navigation and rendering security for historical producer/consensus context, Registry implementation contracts, address history, asset activity, contract deployment and operational diagnostics. Producer trace and Registry implementation contradictions fail closed; internal resource identifiers are validated before links are generated; untrusted labels are escaped; diagnostic states explicitly expose wrong-chain, stale, degraded and inconsistent projections.

The branch is intentionally based on qualified EXP-NEXT.2 head `f660db960b46a47215ed11bcbd0a8d79b6be8e98` because PR #385 was not yet merged into main when EXP-NEXT.3 began. This preserves the canonical dependency without pretending current main already contains it.

Live canonical producer witnesses, deployed consensus-provider proof, production availability/SLA and Genesis readiness remain outside EXP-NEXT.3.


## Candidate qualification evidence

Candidate `f64228faab3218bb50f6ba4b1b42b77cda9d3b85` passed the dedicated EXP-NEXT.3 workflow (run `36474436338`, artifact `10992649147`) plus retained EXP-2.2–2.6, EXP-NEXT.2, EXP-1.7/1.8/1.10, 420Indexer, 420Docs and 420 Integrated Qualification. Integrated offline-core, fault-matrix, production-dependencies and geth-engine all succeeded.

The commit containing this COMPLETE record is a new qualification target. Its exact SHA must itself pass the dedicated EXP-NEXT.3 workflow and every required retained workflow that triggers for it. No earlier SHA qualifies that evidence-recording HEAD.


## Candidate exact-head evidence recorded

Candidate head `f64228faab3218bb50f6ba4b1b42b77cda9d3b85` passed the full required suite before this evidence-recording change:

- EXP-NEXT.3 dedicated browser workflow: `36474436338` — SUCCESS — artifact `10992649147`
- EXP-2.2: `36474436487` — SUCCESS
- EXP-2.3: `36474436197` — SUCCESS
- EXP-2.4: `36474436270` — SUCCESS
- EXP-2.5: `36474436111` — SUCCESS
- EXP-2.6: `36474436259` — SUCCESS
- EXP-NEXT.2: `36474436421` — SUCCESS
- EXP-1.7: `36474436441` — SUCCESS
- EXP-1.8: `36474436201` — SUCCESS
- EXP-1.10: `36474436356` — SUCCESS
- 420Indexer: `36474436561` — SUCCESS
- 420Docs: `36474436121` — SUCCESS
- 420 Integrated: `36474436526` — SUCCESS
  - geth-engine SUCCESS
  - production-dependencies SUCCESS
  - offline-core SUCCESS
  - fault-matrix SUCCESS

This evidence-recording change creates a new qualification target. The exact new HEAD must itself pass the dedicated EXP-NEXT.3 workflow and all retained required workflows before the COMPLETE status becomes effective. No older SHA may qualify the new evidence-recording head.
