# 420 Stake errors and retries

Typical caller-visible failures include invalid validator identity/BLS key, duplicate owner or BLS key, invalid collateral composition, invalid lifecycle transition, activation/exit/withdrawal timing violations, unauthorized owner/withdrawal/reserve calls, and failed native-420 transfers.

Consensus-only paths additionally fail closed on an unbound or incorrect consensus-system caller. Slash application rejects zero evidence and evidence that has already been applied. Reward application rejects the wrong execution block, duplicate reward application for a block, a zero proposer, and malformed participant sets including duplicate participants or a participant equal to the proposer.

Do not blindly retry deterministic lifecycle, authorization, slash-evidence, or reward-replay failures. A transaction or system-call retry must first re-read canonical state and determine whether the original operation already committed. Retry transient RPC/indexer failures only with bounded backoff and a canonical re-read.
