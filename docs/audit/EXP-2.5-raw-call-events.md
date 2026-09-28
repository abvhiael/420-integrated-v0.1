# EXP-2.5 — Raw transaction call and contract-event inspection qualification

EXP-2.5 qualifies the repository service/API layer for inspecting raw failed-call context and complete transaction/block log payloads.

## Repository guarantees

- Transaction detail preserves indexed `valueWei` and raw `input`.
- Reverted transactions retain the same raw call context as successful transactions.
- Transaction and block detail expose a stable raw-event DTO containing block/transaction/log position, emitting address, every raw topic, raw data, and decoder-version provenance.
- Populated transaction input and event address/topic/data fields are validated as hex byte strings with the appropriate fixed widths for addresses/topics.
- Malformed raw payloads fail closed instead of being silently presented.
- Empty legacy fields remain accepted where absence is permitted; explicit `0x` empty calldata/data is preserved.
- Raw event values remain primary. ABI-decoded semantics, if later added, are secondary presentation owned by later milestones.

## Deferred boundaries

This milestone does not qualify browser rendering, ABI-decoded event/function labels, revert-reason decoding, live target-network witnesses, verified-source/compiler provenance, or Genesis release readiness.

## EXP-2R reconciliation

The repository-scope EXP-2.5 implementation is **COMPLETE**.

The JSON audit record previously retained the intermediate status `qualified_candidate_recorded_pending_evidence_head_requalification`. That wording became stale after EXP-2.5 passed again on later exact heads:

- `78ca89dd5302b1655a7a0592bf79473783db2f59` — retained EXP-2.5 run `36384607389`: success.
- `c0b40a61b95192627fd21fabfe7349ecda5a4360` — retained EXP-2.5 run `36454719177`: success.
- `26a06117c7662c0f8986a2f7b505d5180d3121ea` — PR #381 final exact head, EXP-2.5 run `36455530414`: success.

PR #381 merged as `52a162612257122d4c6b6e2ab9e8bc163d1d5f6f`. Comparing the fully qualified PR head to the merge commit reports zero changed files, so the merge node does not alter the qualified file tree.

This reconciliation changes evidence bookkeeping only. It does not claim deployed UI qualification, live target-network qualification, ABI decoding, verified-source qualification, canonical authority, or Genesis readiness.
