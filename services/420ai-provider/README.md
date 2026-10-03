# 420AI provider runtime

This service is the off-chain `420ai` provider/worker runtime for 420Integrated.

It deliberately does **not** own protocol state. A deployment must supply a canonical client that reads the current RPC/Registry/ComputeMarket contracts and implements:

- `environment()` -> canonical chain ID and ComputeRouter graph hash;
- `job(jobId)` -> canonical accepted/running CMP + AI binding snapshot;
- `submitReceipt(...)` -> the current canonical worker/receipt submission path.

The runtime validates canonical identity and deadlines before decrypting private inputs. It signs execution manifests and receipts with the provider's dedicated receipt key, encrypts private payloads at rest with AES-256-GCM, applies bounded retention, redacts sensitive observability fields, and uses stable receipt-derived idempotency plus canonical reconciliation to avoid duplicate submission after timeouts or restarts.

## Security boundaries

Use separate keys for provider/operator transactions, receipt signing, and private-payload encryption. Do not put any of them in `config.example.json`, logs, canonical chain state, or runtime state files.

The local state store contains only workflow identifiers, manifest/receipt digests, canonical result commitments and recovery status. Private payload plaintext and decryption keys are never persisted there.

Restart recovery is fail-closed: canonical chain state wins over the local queue. Interrupted execution is marked recoverable unless the canonical job already records the same result or has become terminal.

## Tests

`npm test`

The suite covers manifest signature integrity, private-payload encryption/scope/expiry, one-shot idempotency, bounded transient retry, lost-response reconciliation, restart recovery, canonical identity/deadline rejection and observability redaction.
