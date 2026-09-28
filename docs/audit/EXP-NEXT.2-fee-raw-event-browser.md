# EXP-NEXT.2 — Transaction-fee and raw-event browser presentation

Status: **COMPLETE — valid only after this evidence-recording HEAD passes exact-head qualification**

Canonical definition: `docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json`.

This increment completes the repository browser work backed by qualified EXP-2.1 fee data and EXP-2.5 raw-call/event data. Transaction detail renders gas used, effective gas price and actual fee independently; preserves raw value/calldata; and rejects missing, non-canonical or inconsistent fee/provenance data. Block and transaction views share one raw-event renderer exposing chain, block/transaction hashes and positions, emitting address, all topics and raw data.

Long raw values are never shortened in the inspectable surface and are copied from the full value. Browser presentation rejects malformed address/hash/topic/data values and escapes hostile text. No ABI-decoded label may replace conflicting raw values.

EXP-WF-003 and EXP-WF-013 now reference this repository evidence. Live target-network witnesses, ABI-semantic qualification, production deployment and Genesis closeout remain outside EXP-NEXT.2.

## Candidate qualification evidence

Candidate head `30e9f78dd786b53bb41fd98c84515695bbc3c1a5` passed the dedicated EXP-NEXT.2 browser workflow (run `36470100265`), retained EXP-2.2–2.6 workflows, EXP-1.7/1.8/1.10, 420Indexer, 420Docs and 420 Integrated Qualification. The dedicated artifact is `10990339622` (`exp-next-2-fee-raw-event-browser`).

The commit containing this COMPLETE record is a new qualification target and must itself pass the required exact-head suite before the status is considered effective.
