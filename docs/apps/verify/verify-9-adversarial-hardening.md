---
title: VERIFY-9 adversarial hardening and failure recovery
audience: [developer, auditor]
category: application
status: development
version: current
---
# VERIFY-9 adversarial hardening and failure recovery

VERIFY-9 hardens the 420Verify public and build surfaces without changing the service trust boundary. Verification remains non-canonical, does not create Registry legitimacy, and cannot grant Wallet, Smart Account, governance, or signing authority.

## Public-input policy

The submission API fails closed on malformed JSON, multiple/trailing JSON values, unknown fields, non-hex addresses/hashes, secret-bearing fields such as private keys or seed phrases, excessive request size, excessive source-file count, oversized individual files, excessive total source bytes, oversized Standard JSON, and oversized flattened sources.

Submissions are bounded by a small concurrent-processing semaphore before they can reach compiler execution. Capacity exhaustion returns a retryable HTTP error rather than creating unbounded compiler work.

## Compiler abuse resistance

VERIFY-4 compiler controls remain mandatory: exact allowlisted compiler versions, binary SHA-256 verification, isolated temporary work directories, network-disabled execution assumptions, input/output byte limits, and execution timeouts. VERIFY-9 adds explicit regression coverage for compiler timeout and output-limit failure paths.

## Failure and recovery behavior

Canonical-chain acquisition fails closed when RPC evidence is unavailable or inconsistent. VERIFY-6 evidence history is append-only, content-hashed, rebuildable after restart, and refuses to start from tampered or non-contiguous records. VERIFY-7 proxy tracking invalidates inherited implementation status whenever the canonical implementation changes and preserves prior generations as history.

Processor output is checked again at the public API boundary: the returned record binding, deployment binding, and classification binding must agree before a result is exposed.

## Security meaning

A successful verification result only states that the submitted source/build evidence corresponds to the deployed code under the recorded conditions. It is not an audit, endorsement, safety assessment, official designation, immutability guarantee, or authorization grant.
