# Swap errors and retries

Common deterministic failures include stale quote, inactive market/route, unauthorized capability, insufficient allowance/balance, minimum-output violation and failed safety/oracle checks.

Do not blindly retry deterministic failures. Refresh state/quote first; only retry transient provider failures with bounded backoff.
