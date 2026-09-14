---
title: Troubleshooting and error deep links
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: current
version: current
---

# DOC-14.5 — Troubleshooting and error deep links

DOC-14 contextual help routes runtime failures into the canonical DOC-11 troubleshooting registry without copying recovery procedures into Wallet, dApps, CLI output or operator tooling.

## Stable runtime identifier

When a runtime surface already knows a stable `TRB-<DOMAIN>-<NNN>` identifier, that identifier is the preferred help key. The runtime must not translate it into a separate application-owned error meaning.

The target anchor is the canonical DOC-11 entry whose heading contains the exact stable `TRB-*` ID. Published IDs are permanent and must not be reassigned.

## Routing order

For contextual error help, clients use this order:

1. If an exact stable `TRB-*` ID is available, route to that registry entry.
2. If no exact ID exists but the application has a registered contextual troubleshooting target, use that stable `CTX-*` target.
3. Otherwise use `CTX-TRB-001`, the generic search/diagnostics/support workflow.
4. If the active documentation environment or version cannot publish the target safely, show a neutral help-unavailable state.

Clients must not infer a different `TRB-*` ID from free-form error text when multiple causes are plausible.

## Exact-ID URL shape

The preferred route is:

`/versions/<environment>/<token>/troubleshooting/<registry-page>/#trb-domain-nnn`

The environment and token come from DOC-13. The registry page is determined by DOC-11 domain ownership. The fragment is the lower-case form of the exact stable ID.

No client may silently remove the version prefix, cross to another environment, or substitute a different release to make an error link resolve.

## Canonical domain routing

DOC-11 groups stable domains into registry pages:

- Wallet/account/signing/passkey/capability/recovery → `wallet-account-authorization.md`
- Chain/RPC/transaction/finality → `chain-rpc-transactions.md`
- Consensus/validator/node/Engine → `consensus-validator-node.md`
- Indexer/Explorer/Search/Analytics/Status → `indexer-explorer-search-analytics-status.md`
- Payments/token/swap/bridge/stake → `value-movement-economics.md`
- Shared protocols/providers/AI/storage/oracles and related protocol domains → `shared-protocol-provider.md`
- Application-specific conditions → `genesis-application-coverage.md`

DOC-14 does not create a second troubleshooting taxonomy. It consumes the DOC-11 domain allocation.

## Runtime error mapping

A runtime error may carry both an implementation error code and a documentation troubleshooting ID. These are different identifiers:

- implementation error codes are owned by the runtime/API/contract surface;
- `TRB-*` IDs are owned by DOC-11 and identify recovery guidance.

A mapping from implementation error to `TRB-*` is valid only when the runtime team can state the recovery condition unambiguously. If several root causes can produce the same implementation error, route to the broader contextual troubleshooting target or generic support workflow instead of guessing.

## No duplicated recovery logic

Applications may show short local safety text such as `Do not retry until transaction state is confirmed` or `Stop signing and secure the account`, but the full diagnostic and recovery procedure remains in DOC-11.

Runtime code must not maintain a divergent copy of retry classification, authority ordering, escalation criteria or secret-safety guidance.

## Retry and authority safety

Opening documentation never changes retry safety. A timeout is not proof of failure, a derived UI is not canonical state, and a help page is not authorization to resubmit a write.

Before a client offers a retry action, it must follow the runtime/protocol rules for transaction identity, nonce, payment ID, bridge message ID, proposal ID, job ID or other canonical object state. Documentation may explain the rule but cannot establish the state.

## Safe fallback behavior

When a specific troubleshooting entry is unavailable:

- do not guess another `TRB-*` ID;
- do not redirect to a different environment;
- do not silently redirect historical links to current content;
- prefer the registered application troubleshooting target if one exists;
- otherwise use `CTX-TRB-001` for search, diagnostics and escalation;
- if even that target is unavailable under the active DOC-13 publication state, show a neutral help-unavailable state.

## Privacy

Error-help URLs must not contain secrets, private payloads or raw diagnostics. Stable IDs and static anchors are sufficient for routing. Diagnostic evidence is collected only under the DOC-11 copy-safe support contract.

## DOC-14.8 validation expectations

Later contextual-link CI will verify that:

- every routed troubleshooting page exists;
- every exact `TRB-*` target points to the matching stable anchor;
- registered contextual troubleshooting targets exist;
- retired or unknown IDs fail closed;
- unpublished environment/version targets cannot be emitted as authoritative links;
- no automatic cross-environment or cross-release fallback is introduced.
