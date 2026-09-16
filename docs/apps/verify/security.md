# Security

420 Verify is designed to prove reproducible correspondence, not to become a security oracle or authority layer.

## Input hardening

The public submission boundary rejects malformed or trailing JSON, secret-bearing fields, invalid addresses/hashes, oversized requests, excessive source-file counts, oversized individual/aggregate source payloads, and invalid source commitments.

## Compiler hardening

Only allowlisted compiler releases may execute. Cached binaries are checksum-verified before use. Compiler execution is bounded by input, output, time, and concurrency limits and is recorded as network-disabled/hermetic reproduction evidence.

## Evidence integrity

Persisted verification records are content-hashed and bound to exact chain/address/runtime-code subjects. Restart reconstruction validates schema, sequence, source commitments, classification bindings, and record hashes. Tampered or inconsistent history fails closed.

## Proxy safety

Proxy and implementation verification are separate. Upgrades invalidate inherited implementation-current status, preventing a previously verified implementation from silently carrying forward after canonical state changes.

## Non-authority guarantees

420 Verify cannot grant Registry legitimacy, Wallet/Smart Account permissions, transfer authority, governance power, audit status, safety status, official endorsement, or immutability claims. Downstream Explorer/AppStore displays must preserve these boundaries and the verification warning.
