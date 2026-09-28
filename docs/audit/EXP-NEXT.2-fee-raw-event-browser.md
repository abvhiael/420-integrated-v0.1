# EXP-NEXT.2 — Transaction-fee and raw-event browser presentation

Status: **IMPLEMENTED_PENDING_EXACT_HEAD_QUALIFICATION**

Canonical definition: `docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json`.

This increment completes the repository browser work backed by qualified EXP-2.1 fee data and EXP-2.5 raw-call/event data. Transaction detail renders gas used, effective gas price and actual fee independently; preserves raw value/calldata; and rejects missing, non-canonical or inconsistent fee/provenance data. Block and transaction views share one raw-event renderer exposing chain, block/transaction hashes and positions, emitting address, all topics and raw data.

Long raw values are never shortened in the inspectable surface and are copied from the full value. Browser presentation rejects malformed address/hash/topic/data values and escapes hostile text. No ABI-decoded label may replace conflicting raw values.

EXP-WF-003 and EXP-WF-013 now reference this repository evidence. Live target-network witnesses, ABI-semantic qualification, production deployment and Genesis closeout remain outside EXP-NEXT.2.
