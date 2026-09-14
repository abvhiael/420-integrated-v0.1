# Bridge errors and retries

Common failures include wrong network fingerprint, inactive/suspended route, disabled direction, non-canonical asset, adapter/verifier mismatch, invalid proof, replay collision, risk-limit exhaustion and safety/accounting halt.

Retry only explicitly retryable transfer states or transient provider failures. Never create a second transfer to bypass replay protection without understanding the original canonical state.
