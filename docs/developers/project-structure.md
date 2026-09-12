---
title: Project structure and starters
audience:
  - developer
category: developer
status: development
version: current
---

# Project structure and starters

DOC-9 does not prescribe one front-end framework or application layout. It does prescribe how a project obtains network identity, canonical contract/service metadata and signing authority.

## Available starters

The checked-in Developer Hub template registry currently exposes:

| Template | Use it for |
| --- | --- |
| `sdk-basic` | minimal read-only `@420/sdk` integration |
| `protocol-reader` | canonical contract/service discovery and protocol reads |
| `wallet-aware` | applications that prepare writes but keep signing inside 420 Wallet |

List the currently registered templates with:

```bash
420 templates
```

Create a project with:

```bash
420 create TEMPLATE PROJECT_NAME [TARGET]
```

For example:

```bash
420 create protocol-reader protocol-inspector
420 create wallet-aware wallet-demo
```

Only template IDs in the checked-in registry are accepted. The scaffolder rejects arbitrary filesystem template sources, unsafe path traversal and silent overwrite of an existing target.

## Recommended logical layers

Even when a framework uses different folders, keep these responsibilities separate.

### Environment/discovery layer

Responsibilities:

- load the selected network manifest;
- validate chain identity;
- load/resolve the canonical contract catalogue;
- discover service endpoints;
- expose environment identity to the rest of the application.

Do not hard-code production contract addresses, service URLs or chain identity in application source when canonical discovery exists.

### Read layer

Responsibilities:

- canonical RPC reads for security-sensitive current state;
- 420Indexer/API reads for search, history and rebuildable projections;
- provenance/finality metadata handling;
- fallback behavior when a derived provider is unavailable.

The read layer must preserve the difference between canonical state and a projection.

### Intent/application layer

Responsibilities:

- build human-readable user intent;
- validate application-level inputs;
- prepare calldata, destination, amount/value and expected bounds;
- request simulation/preflight where available.

This layer may prepare a write. It does not authorize it.

### Wallet boundary

Responsibilities owned by the qualified Wallet/Smart Account runtime include:

- account/controller authority;
- capability/session checks;
- passkey/signature operations;
- nonce handling owned by that integration path;
- user approval;
- submission through the qualified signing path.

A project must not add a developer-owned raw-key fallback when Wallet is unavailable.

### Confirmation layer

Responsibilities:

- retain the submitted transaction hash;
- query canonical receipt/state;
- distinguish pending, included, safe and finalized where the workflow requires it;
- reconcile UI state after reorg/failure;
- never infer durable success solely from an API's optimistic response.

## Configuration discipline

Keep configuration explicit and environment-scoped. At minimum a developer should be able to answer:

- Which manifest selected this network?
- What chain ID is expected?
- Which catalogue/Registry source resolved this contract?
- Is this endpoint canonical RPC or a derived/provider API?
- Which Wallet/Smart Account runtime will authorize writes?
- What confirmation/finality policy does this operation require?

If those answers are hidden inside unrelated application code, move them into the environment/integration boundary.

## Secret discipline

Starter projects must not commit or solicit:

- raw user private keys;
- seed/mnemonic phrases;
- passkey private material;
- validator signing secrets;
- Engine JWTs;
- production service credentials.

Use local/test credentials only in their intended environment and use secret-management mechanisms outside checked-in application source.

## Generated reference boundary

Application code will eventually consume generated ABI/API/SDK/event/error reference from DOC-10. Do not hand-maintain large ABI or error catalogues inside task guides or starter documentation when they can be derived from canonical sources.

## Next

Use [Developer quickstart](quickstart.md) to bootstrap a project and [First read and Wallet-authorized write](first-read-write.md) to exercise the read/write boundary.
