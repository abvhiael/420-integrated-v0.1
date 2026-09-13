---
title: Genesis application manuals
audience:
  - user
  - developer
  - operator
category: applications
status: current
version: current
---

# Genesis application manuals

This section is the canonical task-oriented manual collection for user-facing applications that ship with, or are explicitly scoped to, the 420 Integrated Genesis environment.

The frozen public application inventory remains `config/genesis-applications.json`. DOC-18 additionally reconciles contract-backed Genesis surfaces from `contracts/config/genesis-dapp-contract-map.json` so implementation families that are not separate public-catalog entries still receive governed documentation ownership.

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
- [420 AI](ai/index.md) — model/provider/job/verification/settlement workflows with bounded spend, privacy and off-chain compute execution.
- [420 Attention](attention/index.md) — opt-in sponsor campaigns, consent, proof commitments, reward entitlements and segregated sponsor liabilities.
- [420 Launchpad](launchpad/index.md) — qualified project registration, sale configuration and allocation workflows; registration is not endorsement.
- [420 Faucet](faucet/index.md) — explicitly testnet-only distribution for developer onboarding, with no monetary value and bounded abuse controls.

The completed [Genesis application coverage audit](coverage-audit.md) records the original DOC-8.10 package, navigation, authority/security and scope checks. DOC-18 extends governed coverage to additional contract-map surfaces without rewriting the frozen public Genesis catalog.

## Manual contract

Each user-facing application documented under `docs/apps/<app-id>/` uses the standard package: overview, getting started, user guide, concepts, architecture, permissions, fees, security, troubleshooting, FAQ, and developer integration pages for contracts, API, events, errors and examples.

Generated ABI/API/event/error reference belongs in DOC-10; application manuals explain how to use those interfaces safely.

## Genesis manual inventory

| Application | Class | Manual | Primary role |
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
| 420 AI | Genesis protocol + user app | [available](ai/index.md) | provider/model/job/escrow/reputation AI-compute workflows |
| 420 Attention | Genesis protocol + user app | [available](attention/index.md) | opt-in sponsor campaigns, proofs and attention rewards |
| 420 Token | Genesis protocol + user app | [available](token/index.md) | qualified token-template deployment for the fixed native `$420` creation fee |
| 420 Status | Genesis user app | [available](status/index.md) | network/finality/validator/RPC/protocol service health |
| 420 Faucet | testnet only | [available](faucet/index.md) | no-value testnet distribution and developer onboarding |
| 420 Gaming Protocol | Genesis protocol only | not an application manual target | shared optional-wallet game interoperability; covered by protocol/developer documentation |
| 420 Launchpad | Genesis contract-map application surface | [available](launchpad/index.md) | qualified project launch, sale and allocation workflows |

The protocol-only Gaming Protocol remains part of Genesis but has no standalone user application in the frozen catalog. Launchpad is documented under DOC-18 because it exists as a distinct contract-backed application surface in the Genesis contract map even though it is not a separate entry in the frozen public-catalog file.

## Authority labels every manual must preserve

Every manual must distinguish canonical-state authority, user application over canonical state, derived/rebuildable presentation, replaceable provider/service infrastructure, and testnet-only scope.

Registry, Names and Identity remain bounded to discovery/naming/identity state. Swap, Bridge and Token preserve separate value-domain authorities. Stake, Governance and Arbitration continue that separation. AI and Attention follow the same model: workers/providers do not gain chain authority, result commitments do not become universal truth proofs, sponsors/verifiers do not gain Wallet authority, and raw private payloads/telemetry remain outside canonical public state. Launchpad registration does not create endorsement, investment suitability, asset legitimacy or Wallet authorization. Faucet is strictly testnet-only: it does not define issuance policy, participate in mainnet genesis economics or create monetary entitlement.

## Security and support rule

No manual may instruct a user to disclose private keys or recovery secrets, passkey private material, Wallet signing secrets, validator signing keys, JWT/Engine credentials, private evidence payloads, private Messenger payloads, encrypted Resource payloads, raw Attention telemetry, private AI prompts/datasets/outputs or unrelated private Identity fields. Faucet support requires only a public destination testnet address and normal abuse-control input.

## Documentation history

DOC-8 completed the frozen public Genesis application manual set. DOC-18 extends governed coverage to additional Genesis contract-map surfaces while preserving that frozen catalog boundary.

## Related documentation

- [Genesis application coverage audit](coverage-audit.md)
- [DOC-18 reconciliation roadmap](../audit/DOC-18-ROADMAP.md)
- [Application documentation contract](../contributing/app-documentation-contract.md)
- [420 Launchpad architecture](../architecture/protocols/launchpad.md)
- [Registry, Names, Identity & 420-IS architecture](../architecture/protocols/registry-names-identity-420is.md)
- [Pay, Token, Swap/Exchange & Bridge architecture](../architecture/protocols/pay-token-exchange-bridge.md)
- [Stake, Governance, Treasury & Grants architecture](../architecture/protocols/stake-governance-treasury-grants.md)
- [420 Arbitration architecture](../architecture/protocols/arbitration.md)
- [420AI compute infrastructure](../architecture/infrastructure/420ai-compute-infrastructure.md)
- [Messenger, Notifications & Attention architecture](../architecture/protocols/messenger-notifications-attention.md)
- [420 Wallet user documentation](../users/wallet/index.md)
- [420Indexer infrastructure](../architecture/infrastructure/420indexer.md)
- [Core protocol architecture](../architecture/protocols/index.md)
- `config/genesis-applications.json`
- `contracts/config/genesis-dapp-contract-map.json`
- `testnet/services/faucet-policy.json`
- `testnet/public-services/faucet/operations.json`
