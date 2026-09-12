# Token errors and retries

Common deterministic failures include disabled/unknown template, invalid configuration, incorrect creation fee, insufficient gas/value and failed treasury forwarding.

Do not retry unchanged deterministic failures. Refresh Registry/template state and correct the request first.
