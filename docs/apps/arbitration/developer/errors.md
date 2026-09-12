# Arbitration errors and retries

Typical failures include inactive domain, invalid parties/origin, evidence window closed, unauthorized evidence submitter, wrong resolver, duplicate ruling, appeal unavailable/expired/capped and premature finalization.

Do not blindly retry deterministic policy failures. Retry transient transport/indexer failures with bounded backoff and canonical re-read.