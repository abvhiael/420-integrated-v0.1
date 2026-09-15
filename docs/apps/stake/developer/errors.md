# 420 Stake errors and retries

Typical failures include insufficient/invalid collateral, unauthorized validator action, invalid lifecycle transition, cooldown/withdrawal not yet available and stale derived state.

Do not blindly retry deterministic lifecycle failures. Retry transient RPC/indexer failures with bounded backoff and canonical re-read.