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

- [420 Wallet](wallet/index.md) — account management, authorization, security, economics, troubleshooting and developer integration.
- [420 Explorer](explorer/index.md) — blocks, transactions, receipts/logs, addresses, contracts, provenance and finality-aware chain inspection.
- [420 Search](search/index.md) — unified public discovery with explicit provenance, privacy boundaries and ranking-as-presentation semantics.
- [420 Analytics](analytics/index.md) — reproducible metrics, trends and dashboards with source-window, version and finality context.
- [420 AppStore](appstore/index.md) — curated application discovery with Registry-backed provenance, permission/security context and non-authoritative ranking/curation.
- [420 Verify](verify/index.md) — reproducible deployed-source/build verification with explicit result classes and no audit/endorsement implication.
- [420 Notifications](notifications/index.md) — opt-in, replay-safe alerts that preserve event provenance without gaining execution authority.
- [420 Status](status/index.md) — network/service health, readiness and incident presentation that remains observational rather than canonical.
- [420 Registry](registry/index.md) — canonical service discovery/versioning with explicit limits on what registration means.
- [420 Names](names/index.md) — `.420` lease, forward/reverse resolution, transfer and expiry workflows.
- [420 Identity](identity/index.md) — optional pseudonymous profiles, governed issuers and lifecycle-bound credentials.
- [420 Swap](swap/index.md) — bounded canonical swap execution with explicit route, authorization, fee, minimum-output and safety semantics.
- [420 Bridge](bridge/index.md) — verified, replay-protected cross-chain movement with explicit chain/asset/route/proof/risk boundaries.
- [420 Token](token/index.md) — governed-template ERC asset deployment with deterministic provenance and the exact 42 native `$420` creation fee.
- [420 Stake](stake/index.md) — validator bond/lifecycle/reward visibility without public delegation or stake-weighted governance.
- [420 Governance](governance/index.md) — frozen proposal rules/electorates, voting, timelock and exact committed execution.
- [420 Arbitration](arbitration/index.md) — domain-scoped disputes, evidence commitments, rulings, bounded appeals and explicit remedy-consumption boundaries.

## Manual contract

Each user-facing application is documented under `docs/apps/<app-id>/` using the standard package: overview, getting started, user guide, concepts, architecture, permissions, fees, security, troubleshooting, FAQ, and developer integration pages for contracts, API, events, errors and examples.

Generated ABI/API/event/error reference belongs in DOC-10; DOC-8 explains how to use those interfaces safely.

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
| 420 Registry | Genesis protocol + user app | [available](registry/index.md) | canonical registered contract/token/application/service discovery |
| 420 Names | Genesis protocol + user app | [available](names/index.md) | human-readable `.420` names layered over canonical identities |
| 420 Identity | Genesis protocol + user app | [available](identity/index.md) | optional pseudonymous profiles, credentials and reputation |
| 420 Arbitration | Genesis protocol + user app | [available](arbitration/index.md) | dispute cases, evidence commitments, rulings and bounded appeals |
| 420 Swap | Genesis protocol + user app | [available](swap/index.md) | canonical exchange/swap user surface |
| 420 Bridge | Genesis protocol + user app | [available](bridge/index.md) | verified, replay-protected cross-chain value movement |
| 420 Stake | Genesis protocol + user app | [available](stake/index.md) | validator bond, registration, lifecycle, rewards and withdrawals |
| 420 Governance | Genesis protocol + user app | [available](governance/index.md) | proposals, houses, voting, treasury and timelock workflows |
| 420 AI | Genesis protocol + user app | required | provider/model/job/escrow/reputation AI-compute workflows |
| 420 Attention | Genesis protocol + user app | required | opt-in sponsor campaigns, proofs and attention rewards |
| 420 Token | Genesis protocol + user app | [available](token/index.md) | qualified token-template deployment for the fixed native `$420` creation fee |
| 420 Status | Genesis user app | [available](status/index.md) | network/finality/validator/RPC/protocol service health |
| 420 Faucet | testnet only | required, testnet-scoped | no-value testnet distribution and developer onboarding |
| 420 Gaming Protocol | Genesis protocol only | not an application manual target | shared optional-wallet game interoperability; covered by protocol/developer documentation |

The protocol-only Gaming Protocol remains part of Genesis, but it has no standalone user application in the frozen catalog.

## Authority labels every manual must preserve

Every manual must distinguish canonical-state authority, user application over canonical state, derived/rebuildable presentation, replaceable provider/service infrastructure, and testnet-only scope.

Registry, Names and Identity remain bounded to discovery/naming/identity state. Swap, Bridge and Token preserve separate value-domain authorities. Stake, Governance and Arbitration continue that separation: validator collateral does not become governance weight, a passed proposal cannot bypass its exact committed action/timelock path, and a finalized arbitration ruling does not create blanket custody or execution authority.

## Security and support rule

No manual may instruct a user to disclose private keys or recovery secrets, passkey private material, Wallet signing secrets, validator signing keys, JWT/Engine credentials, private evidence payloads, private Messenger payloads, encrypted Resource payloads, raw Attention telemetry or unrelated private Identity fields.

## DOC-8 build order

1. **DOC-8.1 — Application catalog and coverage contract** — complete.
2. **DOC-8.2 — 420 Wallet application package** — COMPLETE.
3. **DOC-8.3 — Explorer, Search and Analytics manuals** — COMPLETE.
4. **DOC-8.4 — AppStore, Verify, Notifications and Status manuals** — COMPLETE.
5. **DOC-8.5 — Registry, Names and Identity manuals** — COMPLETE.
6. **DOC-8.6 — Swap, Bridge and Token manuals** — COMPLETE.
7. **DOC-8.7 — Stake, Governance and Arbitration manuals — COMPLETE** — documents validator economics/lifecycle without public delegation or stake-weighted governance, proposal/voting snapshots plus exact timelocked execution, and domain-scoped dispute/evidence/ruling/appeal flows without turning Arbitration into custody or a cross-protocol superuser.
8. **DOC-8.8 — AI and Attention manuals** — provider/job/compute and opt-in engagement/reward workflows.
9. **DOC-8.9 — Faucet manual** — explicitly testnet-only acquisition, limits, abuse controls and troubleshooting.
10. **DOC-8.10 — Genesis application coverage audit** — confirm every required manual/package, navigation path, authority warning and cross-link before phase closeout.

## Related documentation

- [Application documentation contract](../contributing/app-documentation-contract.md)
- [Registry, Names, Identity & 420-IS architecture](../architecture/protocols/registry-names-identity-420is.md)
- [Pay, Token, Swap/Exchange & Bridge architecture](../architecture/protocols/pay-token-exchange-bridge.md)
- [Stake, Governance, Treasury & Grants architecture](../architecture/protocols/stake-governance-treasury-grants.md)
- [420 Arbitration architecture](../architecture/protocols/arbitration.md)
- [420 Wallet user documentation](../users/wallet/index.md)
- [420Indexer infrastructure](../architecture/infrastructure/420indexer.md)
- [Core protocol architecture](../architecture/protocols/index.md)
- `config/genesis-applications.json`
