# Security

420 Verify is designed to prove reproducible correspondence, not to become a security oracle or authority layer.

## Input hardening

The public submission boundary rejects malformed or trailing JSON, secret-bearing fields, invalid addresses/hashes, oversized requests, excessive source-file counts, oversized individual/aggregate source payloads, and invalid source commitments.

## Compiler hardening

Only allowlisted compiler releases may execute. Cached binaries are checksum-verified before use. Compiler execution is bounded by input, output, time, and concurrency limits and is recorded as network-disabled/hermetic reproduction evidence.

## Evidence integrity

Persisted verification records are content-hashed and bound to exact chain/address/runtime-code subjects. Restart reconstruction validates schema, sequence, source commitments, classification bindings, and record hashes. Tampered or inconsistent history fails closed.

## Proxy safety

Proxy and implementation verification are separate. Persisted relationships are block-scoped historical evidence. Because the production entrypoint does not continuously monitor upgrades, downstream consumers must revalidate canonical proxy state before presenting a relationship as current, and verification must never carry forward from an old implementation to a new one.

## Non-authority guarantees

420 Verify cannot grant Registry legitimacy, Wallet/Smart Account permissions, transfer authority, governance power, audit status, safety status, official endorsement, or immutability claims. Downstream Explorer/AppStore displays must preserve these boundaries and the verification warning.
