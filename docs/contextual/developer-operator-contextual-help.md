---
title: Developer and operator contextual help
audience:
  - developer
  - operator
category: concepts
status: current
version: current
---

# DOC-14.6 — Developer and operator contextual help

Developer and operator surfaces may expose contextual links into canonical 420Docs guidance, generated reference and troubleshooting material. These links improve navigation; they do not promote documentation, generated output, dashboards, Indexer projections or service health into protocol authority.

## Developer contextual targets

The developer map provides stable targets for:

- developer overview and integration model;
- contracts and interfaces;
- deployment workflow;
- diagnostics and correlation;
- API fallback and reliability;
- generated reference;
- network identity;
- transaction/finality guidance.

SDKs, CLI tools, RPC consoles, Developer Hub surfaces and application developer panels should emit a stable `CTX-DEV-*` ID rather than hard-code site URLs.

## Operator contextual targets

Operator surfaces provide stable targets for:

- incident diagnostics and evidence collection;
- consensus/validator/node recovery;
- derived-service and status/readiness diagnosis;
- chain/RPC/transaction/finality diagnosis.

Monitoring, node administration and operational dashboards must not treat a contextual link as permission to restart, retry, rotate signers, clear persistence, lower quorum thresholds or otherwise mutate canonical state. Recovery decisions remain governed by the underlying protocol/operator contracts.

## Generated reference boundary

Generated DOC-10 pages describe machine-derived interfaces and published environment-scoped reference. They do not create contract deployment authority, chain identity, finality, provider trust or runtime support merely because an entry exists.

A contextual link into generated reference is appropriate for method, event, error, RPC, Indexer, SDK/CLI, network or deployment lookup. The caller must still verify the environment and the relevant canonical runtime source.

## Network and deployment boundary

Contextual links may direct developers to network and deployment documentation, but the application or operator tooling must verify actual chain ID, environment, Registry/deployment evidence and runtime code before acting.

Documentation must never be used to turn an example, development record, stale address or unpublished environment into a canonical deployment.

## Finality and transaction boundary

Explorer, Indexer, Search, Analytics, Status and application UI observations remain derived presentation. When contextual help concerns inclusion, safe/finalized state, reorgs, ambiguous submission or execution outcomes, canonical chain/RPC evidence and protocol-defined finality outrank derived services.

## Diagnostics and incident response

Contextual help should lead operators toward safe evidence collection before recovery. Appropriate evidence includes public identifiers, chain/environment identity, block/finality state, health/readiness, checkpoints and sanitized logs.

Do not place signing keys, Engine JWTs, bearer tokens, private keys, recovery secrets, passkey secrets or private payloads into contextual URLs or diagnostics.

## Availability and fail-closed behavior

Developer/operator contextual targets resolve only in documentation environments published by DOC-13. Development content must not be presented as testnet/mainnet authority. Unknown, unpublished, retired or cross-environment targets fail closed.

If a specific contextual target is unavailable, the client may show a neutral help-unavailable state or the environment-appropriate 420Docs landing page. It must not guess a replacement that changes authority or recovery semantics.

## Authority invariants

- canonical chain/protocol state outranks Indexer, Explorer, Search, Analytics and Status presentation;
- runtime deployment/Registry evidence outranks examples or documentation prose;
- generated reference is descriptive and provenance-scoped;
- documentation never creates finality, deployment, signing or governance authority;
- contextual help does not authorize retries or incident actions;
- no cross-environment or implicit cross-release fallback is allowed.

## Machine-readable map

See `developer-operator-context-map.json` for the stable contextual IDs used by developer and operator surfaces.
