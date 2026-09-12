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
| 420 Wallet | Genesis user app | required | Smart Account management, capabilities, recovery, assets and dApp access |
| 420 Explorer | Genesis user app | required | chain, transaction, contract, validator, asset, governance and finality inspection |
| 420 Search | Genesis user app | required | unified discovery across canonical and registered public ecosystem data |
| 420 Analytics | Genesis user app | required | rebuildable analytics, metrics, trends and dashboards |
| 420 AppStore | Genesis user app | required | non-authoritative application catalogue and security/provenance context |
| 420 Verify | Genesis user app | required | reproducible deployed-contract source verification |
| 420 Notifications | Genesis user app | required | opt-in event alerts with source provenance and no execution authority |
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
| 420 Status | Genesis user app | required | network/finality/validator/RPC/protocol service health |
| 420 Faucet | testnet only | required, testnet-scoped | no-value testnet distribution and developer onboarding |
| 420 Gaming Protocol | Genesis protocol only | not an application manual target | shared optional-wallet game interoperability; covered by protocol/developer documentation |

The protocol-only Gaming Protocol remains part of Genesis, but it has no standalone user application in the frozen catalog. Its integration documentation belongs with protocol and developer documentation rather than inventing a DOC-8 user manual for a UI that does not exist.

## Existing Wallet documentation

DOC-6 already provides the canonical 420 Wallet user journey for:

- onboarding/client selection;
- setup/import/passkeys;
- sending/receiving `$420`;
- dApp connections;
- signing and simulation;
- capabilities/sessions;
- recovery/device safety;
- troubleshooting.

DOC-8 will reuse and link those pages rather than fork their content. The Wallet application package will supply the normal application entry point plus any missing concepts, architecture, permissions, fees, security, FAQ and developer-integration surfaces.

## Authority labels every manual must preserve

Every manual must distinguish whether the application is:

- **canonical-state authority** for a particular protocol domain;
- **a user application over canonical protocol state**;
- **derived/rebuildable presentation**;
- **replaceable provider/service infrastructure**; or
- **testnet-only**.

A frontend badge, index, search result, notification, chart, catalogue entry or status indicator must never be described as stronger authority than its canonical source.

## User-manual minimum

Before a Genesis application manual is complete, a new user must be able to determine:

1. what the app does and when to use it;
2. how to open/start it safely and verify network/application identity;
3. which actions mutate state, transfer value, grant authority or become irreversible;
4. what Wallet signing/capability request to expect;
5. fees, deposits, stakes, limits or economic consequences;
6. security/privacy assumptions;
7. finality/status semantics relevant to the app;
8. how to recover from common failures;
9. where canonical truth lives if the UI disagrees with another service.

## Developer-manual minimum

Where public integration is supported, the developer package must explain:

- canonical service/Registry discovery;
- required contracts/protocols and interface versions;
- authorization/capability scope;
- transaction versus read-only flows;
- API/RPC/indexer dependencies;
- event/finality/reorg behavior;
- error/retry/idempotency expectations;
- privacy boundaries;
- minimal safe integration examples.

Machine-generated ABI/API/event/error tables are linked when available rather than manually copied.

## Security and support rule

No manual may instruct a user to disclose:

- private keys or recovery secrets;
- passkey private material;
- Wallet signing secrets;
- JWT/Engine credentials;
- private Messenger payloads;
- encrypted Resource payloads;
- raw Attention telemetry;
- unrelated private Identity fields.

Support diagnostics should prefer public transaction hashes, addresses, chain IDs, error identifiers, app/service versions and appropriately redacted logs.

## DOC-8 build order

DOC-8 groups applications by user workflow while still producing one predictable package per application:

1. **DOC-8.1 — Application catalog and coverage contract** — this index, exact Genesis inventory, manual standard, exclusions and phase map.
2. **DOC-8.2 — 420 Wallet application package** — integrate the completed DOC-6 user journey and fill the application/developer package around it.
3. **DOC-8.3 — Explorer, Search and Analytics manuals** — chain discovery and derived-data surfaces.
4. **DOC-8.4 — AppStore, Verify, Notifications and Status manuals** — application/security discovery, verification, alerts and operational presentation.
5. **DOC-8.5 — Registry, Names and Identity manuals** — registered discovery, naming and optional identity workflows.
6. **DOC-8.6 — Swap, Bridge and Token manuals** — user-facing value movement and token deployment.
7. **DOC-8.7 — Stake, Governance and Arbitration manuals** — validator, public-governance and dispute workflows.
8. **DOC-8.8 — AI and Attention manuals** — provider/job/compute and opt-in engagement/reward workflows.
9. **DOC-8.9 — Faucet manual** — explicitly testnet-only acquisition, limits, abuse controls and troubleshooting.
10. **DOC-8.10 — Genesis application coverage audit** — confirm every required manual/package, navigation path, authority warning and cross-link before phase closeout.

## Related documentation

- [Application documentation contract](../contributing/app-documentation-contract.md)
- [420 Wallet user documentation](../users/wallet/index.md)
- [Core protocol architecture](../architecture/protocols/index.md)
- [Infrastructure architecture](../architecture/infrastructure/index.md)
- `config/genesis-applications.json`
- `docs/GENESIS-DAPPS.md`
