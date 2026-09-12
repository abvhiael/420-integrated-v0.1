# Errors and retries

Fail closed on chain mismatch or malformed replay batches before checkpoint advancement. Use deterministic deduplication, bounded retry, rate limits and dead-letter handling. A single delivery failure must remain isolated to that subscription/target.
