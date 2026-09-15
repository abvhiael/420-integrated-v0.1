---
title: DOC-14 contextual documentation coverage audit
audience:
  - developer
  - operator
category: contributing
status: current
version: current
---

# DOC-14 contextual documentation coverage audit

DOC-14.10 audits the contextual-documentation system built in DOC-14.1 through DOC-14.9 before the monolithic phase merge.

## Result

**PASS pending exact-head CI closeout.** Functional coverage is complete. Remaining closure conditions are reconciliation with current `main`, exact-head 420Docs Qualification, exact-head 420 Integrated Qualification and merge of PR #233.

## Coverage

- Wallet contextual help covers setup, send/receive, dApp connections, signing review, permissions/sessions, recovery, troubleshooting and overview states.
- Every frozen non-Wallet Genesis user-facing application has deterministic contextual targets for overview, primary task, permissions/signing, economics, security/privacy and troubleshooting.
- 420 Gaming Protocol remains deliberately protocol-only.
- 420 Faucet remains testnet-only and unavailable until DOC-13 publishes a testnet documentation track.
- Runtime troubleshooting routes through stable DOC-11 `TRB-*` identifiers, with application troubleshooting and the general diagnostics route as bounded fallbacks.
- Developer contextual targets cover contracts/interfaces, deployment, diagnostics, API reliability, generated reference, network identity and finality.
- Operator contextual targets cover incident diagnostics, consensus/node recovery, service health and chain/RPC/transaction troubleshooting.

## Version and environment audit

| Route class | Status | Result |
| --- | --- | --- |
| `development/current` | published, mutable | PASS |
| `genesis/current` | published current alias | PASS |
| `genesis/genesis` | published immutable release | PASS |
| `testnet/current` | unpublished | intentionally unavailable |
| `mainnet/current` | unpublished | intentionally unavailable |

Contextual resolution requires both DOC-14 target authority and DOC-13 publication authority. Cross-environment fallback and implicit cross-release fallback are prohibited. Historical requests use an appropriate immutable published release or fail closed.

## CI and publication audit

The unified 420Docs qualification runner contains contextual-registry, contextual-version-coupling and contextual-publication-safety stages. Workflow policy and GitHub Actions path filters include the DOC-14 validator surfaces.

The publication gate rejects missing active targets, invalid troubleshooting mappings and contextual routes that advertise unpublished documentation environments.

## Deliberately unsupported states

These are intentional rather than coverage gaps:

- testnet contextual publication before the DOC-13 testnet track is published;
- mainnet contextual publication before the DOC-13 mainnet track is published;
- a standalone Gaming Protocol user-application contextual namespace;
- development documentation presented as higher-environment authority;
- silent current-version fallback for historical requests;
- guessed troubleshooting IDs for unknown runtime errors.

## Exit-condition assessment

DOC-14 functional coverage is complete. Wallet, Genesis applications and supported runtime/developer/operator surfaces have stable contextual help; DOC-11 troubleshooting identifiers remain durable; DOC-13 version/environment rules remain authoritative; unavailable targets fail closed; and CI protects publication from stale or unpublished contextual routes.
