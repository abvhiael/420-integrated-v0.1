---
title: Genesis application coverage audit
audience:
  - developer
  - operator
  - architect
category: applications
status: current
version: current
---

# Genesis application coverage audit

DOC-8.10 audits the frozen Genesis application inventory against the task-oriented manual contract established in DOC-8.1.

## Audit result

**PASS.** All 20 user-facing Genesis/testnet manual targets in `config/genesis-applications.json` have the complete standard DOC-8 package and are reachable from the 420Docs application navigation. The protocol-only 420 Gaming Protocol remains intentionally outside the standalone user-application manual set and is routed to protocol/developer documentation.

The standard package is 16 pages per application:

- 10 user/application pages: overview, getting started, user guide, concepts, architecture, permissions, fees, security, troubleshooting and FAQ;
- 6 developer pages: overview, contracts, API, events, errors and examples.

That yields **320 required standard pages across 20 manual targets**. Auxiliary coverage/readme files are allowed but are not substitutes for required pages.

## Frozen inventory coverage

| Application | Class | Package | Navigation | Authority/security boundary | Result |
| --- | --- | ---: | --- | --- | --- |
| 420 Wallet | Genesis user app | 16/16 | present | client remains subordinate to canonical Smart Account/capability state; task journeys link to DOC-6 | PASS |
| 420 Explorer | Genesis user app | 16/16 | present | derived/rebuildable observation; never canonical authority | PASS |
| 420 Search | Genesis user app | 16/16 | present | ranking/discovery is presentation, never authorization or ownership proof | PASS |
| 420 Analytics | Genesis user app | 16/16 | present | derived metrics never override canonical chain/protocol state | PASS |
| 420 AppStore | Genesis user app | 16/16 | present | catalogue/curation does not create Registry legitimacy or Wallet authority | PASS |
| 420 Verify | Genesis user app | 16/16 | present | reproducible build evidence is not audit, endorsement or safety proof | PASS |
| 420 Notifications | Genesis user app | 16/16 | present | opt-in derived delivery; no signing/execution authority | PASS |
| 420 Registry | Genesis protocol + user app | 16/16 | present | canonical registered discovery only; registration is not universal trust | PASS |
| 420 Names | Genesis protocol + user app | 16/16 | present | `.420` aliases never replace canonical service/address identity | PASS |
| 420 Identity | Genesis protocol + user app | 16/16 | present | optional/pseudonymous identity and lifecycle-bound credentials; no ambient Wallet authority | PASS |
| 420 Arbitration | Genesis protocol + user app | 16/16 | present | bounded dispute/ruling authority; remedies require explicit origin-protocol consumption | PASS |
| 420 Swap | Genesis protocol + user app | 16/16 | present | quote != authorization; bounded execution/minimum-output/finality semantics | PASS |
| 420 Bridge | Genesis protocol + user app | 16/16 | present | chain/asset/route/proof/risk/replay checks fail closed | PASS |
| 420 Stake | Genesis protocol + user app | 16/16 | present | validator economics only; no public delegation or stake-weighted governance at Genesis | PASS |
| 420 Governance | Genesis protocol + user app | 16/16 | present | frozen proposal/electorate rules and exact timelocked execution | PASS |
| 420 AI | Genesis protocol + user app | 16/16 | present | off-chain compute with bounded spend/privacy/verification; no consensus privilege | PASS |
| 420 Attention | Genesis protocol + user app | 16/16 | present | explicit opt-in consent, bound proof/reward rules, segregated sponsor liabilities and no Wallet-key authority | PASS |
| 420 Token | Genesis protocol + user app | 16/16 | present | approved templates only; exact 42 native `$420` deployment fee; no native `$420` issuance or downstream legitimacy | PASS |
| 420 Status | Genesis user app | 16/16 | present | observational health/readiness; cannot create finality or protocol state | PASS |
| 420 Faucet | testnet only | 16/16 | present | testnet-only/no monetary value/no mainnet keys/no mainnet genesis economics | PASS |

## Protocol-only exclusion

420 Gaming Protocol is frozen as `GENESIS_PROTOCOL`, not as a user-facing application. DOC-8 therefore does not invent a standalone Gaming application manual. Its shared optional-wallet game interoperability belongs in protocol and DOC-9 developer integration documentation.

## Cross-cutting checks

### Startup and network identity

Every manual identifies its network/application context before state-changing or value-changing actions. Testnet-only Faucet guidance fails closed on non-testnet environments.

### Authorization and signing

Manuals distinguish connection from permission, read operations from state-changing transactions, and application presentation from Wallet/Capability authority. No manual treats a UI response, notification, quote, proof submission or provider result as authorization by itself.

### Economics and finality

Value-bearing applications document fees, reservations, caps, minimum-output or settlement constraints where applicable and distinguish submission/inclusion from safe/finalized state.

### Security and privacy

Support guidance does not request private keys, recovery secrets, passkey private material, Wallet signing secrets, validator signing keys, Engine/JWT credentials, private Messenger payloads, encrypted Resource payloads, raw Attention telemetry, private AI prompts/datasets/outputs or unrelated private Identity fields.

### Developer integration

Every package includes contract/interface guidance, API/provider boundaries, events/finality, errors/retries and safe examples. Generated ABI/NatSpec/RPC/API reference remains reserved for DOC-10 rather than being hand-maintained in DOC-8.

The completed machine-derived reference is available from the [DOC-10 generated reference landing page](../reference/index.md). Application manuals remain task-oriented; use DOC-10 for exact generated contract/NatSpec/ABI status, events/errors, public RPC, 420Indexer API, SDK/CLI, network and deployment reference.

### Faucet scope

420 Faucet is explicitly testnet-only. Its documented policy is 42 testnet `$420` per successful request, a 24-hour per-address cooldown, five requests per IP per hour, a 42,000 testnet `$420` daily operator cap, CAPTCHA or equivalent abuse control, a separate Faucet hot wallet and no mainnet keys. Testnet `$420` carries no monetary value and Faucet never participates in mainnet genesis economics.

## Phase result

DOC-8 satisfies its exit condition: every frozen user-facing Genesis/testnet application has a predictable user/developer/security/troubleshooting package, authority boundaries are explicit, Faucet scope is unambiguous, and the protocol-only Gaming Protocol is routed correctly.

The next documentation phase is [DOC-9 — Developer documentation](../DOCS-ROADMAP.md), which broadens cross-application developer onboarding, local/testnet setup, contracts, RPC/APIs/SDKs, finality/error patterns and end-to-end integrations without replacing these application-specific manuals.
