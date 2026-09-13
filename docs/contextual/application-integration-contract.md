---
title: Contextual documentation application integration contract
audience:
  - developer
  - operator
category: integration
status: current
version: current
---

# DOC-14.9 — Application integration contract

This contract defines how 420 Wallet, Genesis applications and supported developer/operator runtimes integrate contextual documentation without hard-coding site internals or promoting documentation into runtime authority.

## Client contract

Applications store or emit a stable contextual ID such as `CTX-WALLET-005`, not an absolute documentation URL. A resolver receives:

- contextual ID;
- active runtime environment;
- documentation version intent (`current` or an explicit immutable release);
- optional known stable troubleshooting ID such as `TRB-TX-003`.

The resolver consults the DOC-14 contextual registry and DOC-13 version registry, then either returns a published version-qualified URL or an unavailable result. It must never invent a target, change environments, or silently move a historical request onto current documentation.

## Resolution sequence

1. Normalize the contextual ID or approved alias to its canonical `CTX-*` record.
2. Reject unknown, retired-without-replacement, audience-incompatible or otherwise invalid records.
3. Confirm that the requested runtime environment is allowed by the contextual record.
4. Resolve the documentation token under DOC-13:
   - `current` requires a published current alias for the same environment;
   - an explicit release requires a published release in the same environment;
   - durable historical links require an immutable release.
5. Confirm that the target page/anchor is published for that environment/version.
6. Return a version-qualified documentation route.
7. If any step fails, return `unavailable` rather than crossing environments/releases or fabricating a path.

Canonical route shape:

`/versions/<environment>/<token>/<path>[#anchor]`

Client code must not depend on MkDocs source paths, theme structure, rendered navigation DOM, repository branch names or generated site-directory layout.

## Troubleshooting integration

When runtime code already has a stable DOC-11 `TRB-*` identifier, it should pass that identifier to the troubleshooting resolver instead of selecting a prose title or guessing from an error string.

The application may display short local safety language before the documentation link, such as `Do not retry until transaction status is checked`, but the canonical diagnosis/recovery procedure remains in DOC-11. Applications must not fork troubleshooting guidance into a competing local copy.

Unknown runtime errors may fall back to an application troubleshooting contextual ID or `CTX-TRB-001`. They must not be guessed into a narrower `TRB-*` condition.

## Runtime authority boundary

A contextual-help result is navigation only. Resolution success does not establish:

- transaction inclusion, success or finality;
- chain/network identity;
- contract deployment authenticity;
- Wallet/Smart Account authorization;
- permission/capability state;
- account recovery authority;
- bridge settlement/proof validity;
- governance eligibility or execution authority;
- provider correctness, freshness or availability;
- incident recovery permission.

Applications must establish those facts from their canonical runtime sources before enabling state-changing behavior.

## Telemetry and privacy

Contextual-help telemetry is optional and must be privacy-minimizing.

Allowed coarse events include:

- contextual ID requested;
- resolution outcome (`resolved`, `unavailable`, `retired`);
- environment token;
- client/application identifier;
- documentation version token;
- anonymous aggregate click/open count.

Do not place or log these values in contextual URLs or help telemetry:

- seed phrases or private keys;
- passkey/recovery secrets;
- bearer/session/API credentials;
- private Messenger content;
- raw AI prompts, datasets or outputs;
- private Identity attributes;
- unredacted logs or authentication headers;
- transaction signing payloads containing private application/user data.

Public runtime identifiers such as transaction hashes, proposal IDs or bridge message IDs are not part of the base DOC-14 URL contract. Any future parameterized diagnostic links require an explicit documented safe parameter schema before clients may attach them.

## Offline and unavailable behavior

If documentation cannot be resolved or reached:

1. keep the runtime safety state unchanged;
2. show a neutral `Help unavailable` state;
3. preserve the stable contextual or troubleshooting ID so the user can reference it later;
4. optionally expose locally bundled non-authoritative safety text that does not replace canonical recovery guidance;
5. never weaken signing, retry, value-movement, permission or recovery checks because help is offline;
6. never redirect to development documentation and label it as Genesis/testnet/mainnet guidance.

Caching is allowed only when the client can preserve the environment/version identity of the cached documentation. Historical cached documentation must retain its immutable release identity.

## Representative integrations

### Wallet signing review

Runtime state: a transaction is awaiting user review.

Client emits `CTX-WALLET-005` with environment `genesis` and version intent `current`.

The resolver may return the Genesis-current signing/transaction review route. The Wallet still obtains signing authority from the canonical Wallet/Smart Account state; the documentation link cannot approve or sign anything.

### Genesis dApp value action

Runtime state: a Swap or Bridge flow is displaying fees and settlement risk.

The dApp selects the registered fees/economics or security contextual slot from the Genesis dApp context map. Resolution remains within the active Genesis documentation track. Quote validity, allowance, signing, minimum-output, proof and settlement checks remain runtime responsibilities.

### Runtime error

Runtime state: code receives a known stable `TRB-TX-*` identifier.

The client resolves the exact DOC-11 domain/page/anchor. If the stable ID is unavailable under the active documentation environment/version, the client shows a generic troubleshooting fallback rather than guessing another condition.

### Developer CLI

Runtime state: the CLI needs help for network identity or finality semantics.

The CLI emits `CTX-DEV-007` or `CTX-DEV-008`. The resolver returns the version-qualified developer guide. CLI output may also show the contextual ID for copy/paste diagnostics without embedding a permanent hard-coded site URL.

### Operator incident surface

Runtime state: a node/operator dashboard exposes an incident-help action.

The surface uses the registered `CTX-OPS-*` target for diagnostics, consensus/node recovery, service health or chain/RPC/transaction troubleshooting. Documentation does not authorize destructive recovery actions; operators still follow canonical runtime evidence and operational controls.

## Integration invariants

Client implementations must preserve these invariants:

- stable IDs are the application-facing API;
- URLs are resolver output, not application constants;
- environment/version resolution is fail-closed;
- testnet/mainnet remain unavailable until DOC-13 publishes them;
- historical links do not silently migrate to current;
- `TRB-*` IDs remain the stable error/recovery semantic identifiers;
- local UI copy may summarize but must not fork canonical recovery guidance;
- help telemetry carries no secrets/private payloads;
- offline documentation never weakens runtime safety;
- documentation never becomes signing, settlement, finality, deployment or authorization authority.
