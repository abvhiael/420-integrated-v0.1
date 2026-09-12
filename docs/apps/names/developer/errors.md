# Names errors and retries

Typical failures include commitment too young/old, commitment mismatch, unavailable label, invalid duration, unauthorized owner action, expired record and invalid reverse binding.

Correct deterministic validation errors before retrying. Transport/indexing failures may be retried with normal backoff.