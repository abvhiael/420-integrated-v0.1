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
