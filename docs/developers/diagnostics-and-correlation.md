---
title: Diagnostics and correlation
audience:
  - developer
category: developer
status: development
version: current
---

# Diagnostics and correlation

Diagnostic tooling should explain disagreements between sources without promoting the diagnostic layer into authority.

## Correlate by stable identifiers

For transaction troubleshooting, preserve and correlate:

- selected environment and chain ID;
- transaction or UserOperation identity;
- Smart Account when applicable;
- block number/hash and receipt state;
- Indexer projection state and freshness;
- owning protocol/service identity and version;
- application request/correlation ID for off-chain workflows.

Do not correlate users by private secrets, raw signing material or unrelated personal data.

## Developer Hub debug surface

The current Developer Hub debug client can correlate the 420Indexer transaction/receipt projection with canonical `eth_getTransactionByHash` and `eth_getTransactionReceipt` evidence. Its log/event/diagnostic commands are read-only.

Indexer evidence remains explicitly non-canonical. Canonical RPC establishes chain transaction/receipt state; owning contracts establish protocol state/authorization.

Useful CLI commands include:

```text
420 debug view
420 debug diagnostics
420 debug tx HASH
420 debug logs [ADDRESS] [LIMIT]
420 debug events PROTOCOL [OBJECT_KEY] [LIMIT]
```

## Preserve provenance

A diagnostic report should label every fact with its source and freshness/finality context. Do not flatten an indexed receipt, RPC receipt, Wallet simulation result and provider status into one unlabeled object.

When sources disagree:

1. verify selected environment and chain identity;
2. verify RPC and Indexer refer to the same chain;
3. compare transaction/receipt provenance;
4. inspect Indexer lag/status;
5. read the owning contract for security-sensitive current state;
6. fail closed on finalized-history disagreement.

## Logging safety

Logs may include public transaction hashes, addresses, block identifiers, service IDs, error codes and correlation IDs. They should not include private keys, seed phrases, passkey private material, raw session secrets, API credentials, encrypted-message plaintext, private AI prompts/datasets or other private protocol payloads.

## Support handoff

A safe support bundle contains reproducible public identifiers and source/finality metadata, not secrets. Prefer transaction hashes, block/hash context, selected network identity, public contract/service IDs, stable error codes and redacted request metadata.

## Related

- [420Indexer API](indexer-api.md)
- [Events, logs and finality](events-and-finality.md)
- [Errors, retries and idempotency](errors-retries-and-idempotency.md)
