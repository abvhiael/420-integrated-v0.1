---
title: Genesis application manuals
audience:
  - user
  - developer
  - operator
category: applications
status: development
version: current
---

# Genesis application manuals

This section is the canonical task-oriented manual collection for user-facing applications that ship with, or are explicitly scoped to, the 420 Integrated Genesis environment.

The authoritative application inventory is `config/genesis-applications.json`. DOC-8 follows that frozen catalog rather than an older hand-maintained app list.

## Available manuals

- [420 Wallet](wallet/index.md) — account management, authorization, security, economics, troubleshooting and developer integration. The detailed end-user task journey remains in the canonical DOC-6 Wallet guides and is linked from this package rather than duplicated.
- [420 Explorer](explorer/index.md) — blocks, transactions, receipts/logs, addresses, contracts, provenance and finality-aware chain inspection.
- [420 Search](search/index.md) — unified public discovery with explicit provenance, privacy boundaries and ranking-as-presentation semantics.
- [420 Analytics](analytics/index.md) — reproducible metrics, trends and dashboards with source-window, version and finality context.
- [420 AppStore](appstore/index.md) — curated application discovery with Registry-backed provenance, permission/security context and non-authoritative ranking/curation.
- [420 Verify](verify/index.md) — reproducible deployed-source/build verification with explicit result classes and no audit/endorsement implication.
- [420 Notifications](notifications/index.md) — opt-in, replay-safe alerts that preserve event provenance without gaining execution authority.
- [420 Status](status/index.md) — network/service health, readiness and incident presentation that remains observational rather than canonical.

## Manual contract

Each user-facing application is documented under:

```text
docs/apps/<app-id>/
```

The standard package is:

```text
index.md
getting-started.md
user-guide.md
concepts.md
architecture.md
permissions.md
fees.md
security.md
troubleshooting.md
faq.md

developer/
  index.md
  contracts.md
  api.md
  events.md
  errors.md
  examples.md
```

A topic may be omitted only when it genuinely does not apply. Application architecture links to the canonical protocol/infrastructure documentation instead of duplicating protocol internals.

Generated ABI/API/event/error reference belongs in DOC-10; the DOC-8 developer pages explain how to use those interfaces safely.

## Genesis manual inventory

| Application | Class | DOC-8 manual | Primary role |
| --- | --- | --- | --- |
| 420 Wallet | Genesis user app | [available](wallet/index.md) | Smart Account management, capabilities, recovery, assets and dApp access |
| 420 Explorer | Genesis user app | [available](explorer/index.md) | chain, transaction, contract, validator, asset, governance and finality inspection |
| 420 Search | Genesis user app | [available](search/index.md) | unified discovery across canonical and registered public ecosystem data |
| 420 Analytics | Genesis user app | [available](analytics/index.md) | rebuildable analytics, metrics, trends and dashboards |
| 420 AppStore | Genesis user app | [available](appstore/index.md) | non-authoritative application catalogue and security/provenance context |
| 420 Verify | Genesis user app | [available](verify/index.md) | reproducible deployed-contract source verification |
| 420 Notifications | Genesis user app | [available](notifications/index.md) | opt-in event alerts with source provenance and no execution authority |
| 420 Registry | Genesis protocol + user app | required | canonical registered contract/token/application/service discovery |
| 420 Names | Genesis protocol + user app | required | human-readable `.420` names layered over canonical identities |
| 420 Identity | Genesis protocol + user app | required | optional pseudonymous profiles, credentials and reputation |
| 420 Arbitration | Genesis protocol + user app | required | dispute cases, evidence commitments, rulings and bounded appeals |
| 420 Swap | Genesis protocol + user app | required | canonical exchange/swap user surface |
| 420 Bridge | Genesis protocol + user app | required | verified, replay-protected cross-chain value movement |
| 420 Stake | Genesis protocol + user app | required | validator bond, registration, lifecycle, rewards and withdrawals |
| 420 Governance | Genesis protocol + user app | required | proposals, houses, voting, treasury and timelock workflows |
| 420 AI | Genesis protocol + user app | required | provider/model/job/escrow/reputation AI-compute workflows |
| 420 Attention | Genesis protocol + user app | required | opt-in sponsor campaigns, proofs and attention rewards |
| 420 Token | Genesis protocol + user app | required | qualified token-template deployment for the fixed native `$420` creation fee |
| 420 Status | Genesis user app | [available](status/index.md) | network/finality/validator/RPC/protocol service health |
| 420 Faucet | testnet only | required, testnet-scoped | no-value testnet distribution and developer onboarding |
| 420 Gaming Protocol | Genesis protocol only | not an application manual target | shared optional-wallet game interoperability; covered by protocol/developer documentation |

The protocol-only Gaming Protocol remains part of Genesis, but it has no standalone user application in the frozen catalog. Its integration documentation belongs with protocol and developer documentation rather than inventing a DOC-8 user manual for a UI that does not exist.

## Existing Wallet documentation

DOC-6 already provides the canonical 420 Wallet user journey for onboarding/client selection, setup/import/passkeys, sending/receiving `$420`, dApp connections, signing/simulation, capabilities/sessions, recovery/device safety and troubleshooting.

DOC-8 reuses and links those pages rather than forking their content. The [Wallet application package](wallet/index.md) supplies the application entry point plus concepts, architecture, permissions, fees, security, FAQ and developer-integration surfaces.

## Authority labels every manual must preserve

Every manual must distinguish whether the application is canonical-state authority for a particular protocol domain, a user application over canonical state, derived/rebuildable presentation, replaceable provider/service infrastructure, or testnet-only.

A frontend badge, index, search result, notification, chart, catalogue entry or status indicator must never be described as stronger authority than its canonical source.

Explorer, Search, Analytics, AppStore, Verify, Notifications and Status are first-class Genesis applications while still preserving this boundary: useful application state and evidence do not automatically become protocol truth.

## User-manual minimum

Before a Genesis application manual is complete, a new user must be able to determine what the app does, how to start it safely, which actions change state/value/authority, what Wallet request to expect, economics, security/privacy assumptions, relevant finality/status semantics, common recovery paths and where canonical truth lives if the UI disagrees with another service.

## Developer-manual minimum

Where public integration is supported, the developer package must explain canonical service/Registry discovery, required interfaces, authorization scope, read/write flows, API/RPC/indexer dependencies, event/finality/reorg behavior, error/retry/idempotency expectations, privacy boundaries and minimal safe examples.

Machine-generated ABI/API/event/error tables are linked when available rather than manually copied.

## Security and support rule

No manual may instruct a user to disclose private keys or recovery secrets, passkey private material, Wallet signing secrets, JWT/Engine credentials, private Messenger payloads, encrypted Resource payloads, raw Attention telemetry or unrelated private Identity fields.

Support diagnostics should prefer public transaction hashes, addresses, chain IDs, error identifiers, app/service versions and appropriately redacted logs.

## DOC-8 build order

1. **DOC-8.1 — Application catalog and coverage contract** — complete.
2. **DOC-8.2 — 420 Wallet application package** — COMPLETE.
3. **DOC-8.3 — Explorer, Search and Analytics manuals** — COMPLETE.
4. **DOC-8.4 — AppStore, Verify, Notifications and Status manuals — COMPLETE** — documents catalogue/curation boundaries, reproducible verification semantics, replay-safe notification delivery and observational health/incident presentation without promoting any of them into canonical authority.
5. **DOC-8.5 — Registry, Names and Identity manuals** — registered discovery, naming and optional identity workflows.
6. **DOC-8.6 — Swap, Bridge and Token manuals** — user-facing value movement and token deployment.
7. **DOC-8.7 — Stake, Governance and Arbitration manuals** — validator, public-governance and dispute workflows.
8. **DOC-8.8 — AI and Attention manuals** — provider/job/compute and opt-in engagement/reward workflows.
9. **DOC-8.9 — Faucet manual** — explicitly testnet-only acquisition, limits, abuse controls and troubleshooting.
10. **DOC-8.10 — Genesis application coverage audit** — confirm every required manual/package, navigation path, authority warning and cross-link before phase closeout.

## Related documentation

- [Application documentation contract](../contributing/app-documentation-contract.md)
- [420 Wallet user documentation](../users/wallet/index.md)
- [420Indexer infrastructure](../architecture/infrastructure/420indexer.md)
- [Observability, Status & Operator Services](../architecture/infrastructure/observability-status-operator-services.md)
- [Core protocol architecture](../architecture/protocols/index.md)
- [Infrastructure architecture](../architecture/infrastructure/index.md)
- `docs/420INDEXER-API-V1.md`
- `config/genesis-applications.json`
- `docs/GENESIS-DAPPS.md`
