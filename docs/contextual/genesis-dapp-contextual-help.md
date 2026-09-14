---
title: Genesis dApp contextual help contract
audience:
  - user
  - developer
  - operator
category: applications
status: current
version: current
---

# DOC-14.4 — Genesis dApp contextual help

DOC-14.4 maps the frozen Genesis application inventory into stable contextual-help targets without allowing application UIs to redefine protocol authority, signing semantics, economics, security guidance or recovery behavior.

## Inventory authority

`config/genesis-applications.json` and the completed DOC-8 coverage audit define the frozen application set. DOC-14 does not invent new Genesis applications or promote protocol-only components into user applications.

420 Wallet is already covered by DOC-14.3. This phase adds contextual targets for the remaining user-facing Genesis applications plus the explicitly testnet-only Faucet.

420 Gaming Protocol remains protocol-only. It does not receive a standalone user-application contextual namespace in DOC-14.4; developer/runtime integration belongs to DOC-14.6 and the existing DOC-9 Gaming Protocol documentation.

## Standard contextual package

Every supported application namespace exposes six stable contextual targets:

1. `001` — application overview/concept;
2. `002` — primary user task guide;
3. `003` — permissions/authorization guidance;
4. `004` — fees/economics guidance;
5. `005` — security/privacy guidance;
6. `006` — application troubleshooting.

The registry points these IDs to the canonical DOC-8 package rather than copying content into application code.

## Genesis application namespaces

The following application domains are registered for `development` and `genesis` documentation tracks:

| Application | Context domain | Runtime surface |
| --- | --- | --- |
| 420 Explorer | `EXPLORER` | `420-explorer` |
| 420 Search | `SEARCH` | `420-search` |
| 420 Analytics | `ANALYTICS` | `420-analytics` |
| 420 AppStore | `APPSTORE` | `420-appstore` |
| 420 Verify | `VERIFY` | `420-verify` |
| 420 Notifications | `NOTIFY` | `420-notifications` |
| 420 Registry | `REGISTRY` | `420-registry` |
| 420 Names | `NAMES` | `420-names` |
| 420 Identity | `IDENTITY` | `420-identity` |
| 420 Arbitration | `ARBITRATION` | `420-arbitration` |
| 420 Swap | `SWAP` | `420-swap` |
| 420 Bridge | `BRIDGE` | `420-bridge` |
| 420 Stake | `STAKE` | `420-stake` |
| 420 Governance | `GOV` | `420-governance` |
| 420 AI | `AI` | `420-ai` |
| 420 Attention | `ATTENTION` | `420-attention` |
| 420 Token | `TOKEN` | `420-token` |
| 420 Status | `STATUS` | `420-status` |

The Faucet uses `FAUCET` / `420-faucet` but is registered only for the `testnet` environment. Because DOC-13 does not yet publish a testnet documentation track, those records are intentionally non-resolvable as authoritative runtime links until testnet publication exists.

## State-changing and value-changing actions

Applications should select the task, permissions, economics and security IDs appropriate to the state visible to the user before a write is signed or submitted. Contextual help does not authorize the action and does not prove that a quote, balance, proposal, bridge route, stake state, registry record, token template, arbitration state, AI job or attention reward is current or canonical.

Runtime clients must establish canonical state through the chain, protocol contracts, Registry, Wallet/capability state and other authoritative sources documented by each application package.

## Signing and permissions

Connection is not authorization. A help page must never be treated as evidence that a Wallet session, capability, passkey, owner, operator, recovery authority or application permission exists.

When a user is about to sign or grant reusable authority, applications should expose their namespace `003` permissions target and, where Wallet review is involved, may additionally expose the DOC-14.3 Wallet signing/permissions IDs.

## Economics

The namespace `004` target is the canonical application-level fees/economics explanation. Runtime amounts, quotes, minimum outputs, fee estimates, caps, settlement values and eligibility must still come from canonical runtime state.

A documentation value is explanatory, not a live quote.

## Security and privacy

The namespace `005` target is the canonical application security/privacy guidance. Contextual URLs must never embed private keys, seed phrases, passkey secrets, recovery material, bearer credentials, private Messenger content, private AI prompts/datasets/results, raw Attention telemetry or unrelated Identity data.

Applications may show concise local warnings for dangerous actions, but those warnings must not contradict canonical documentation.

## Troubleshooting

The namespace `006` target opens the application-specific troubleshooting package. DOC-14.5 will add exact runtime-error routing into stable DOC-11 `TRB-*` anchors.

Applications must not fork recovery procedures into a competing local knowledge base. Local UI text should identify the problem, preserve immediate safety, and route to canonical guidance.

## Application-specific authority boundaries

The contextual mapping preserves the DOC-8 boundaries:

- Explorer, Search, Analytics and Status are observational/derived surfaces and never create canonical state or finality.
- AppStore catalogue/curation does not create Registry legitimacy or Wallet authority.
- Verify evidence is not an audit, endorsement or universal safety proof.
- Notifications delivery is derived and grants no signing/execution authority.
- Registry registration is canonical registered discovery, not universal trust.
- Names aliases never replace canonical address/service identity.
- Identity remains optional/pseudonymous and grants no ambient Wallet authority.
- Arbitration authority is bounded to explicit dispute/ruling consumption by origin protocols.
- Swap quotes are not authorization; execution remains bounded by minimum-output and settlement rules.
- Bridge flows must preserve chain, asset, route, proof, risk and replay checks.
- Stake covers validator economics and does not imply public delegation or stake-weighted Genesis governance.
- Governance follows the frozen proposal/electorate/timelock rules.
- AI compute remains off-chain with bounded spend/privacy/verification and no consensus privilege.
- Attention requires explicit consent/proof/reward rules and has no Wallet-key authority.
- Token uses approved templates and the documented deployment fee without creating native `$420` issuance authority or downstream legitimacy.
- Faucet remains testnet-only, no-value and isolated from mainnet keys/economics.

## Failure behavior

A client fails closed when a contextual ID is unknown, its environment is not published, its target no longer exists, or resolving it would require cross-environment or implicit cross-release fallback. A generic same-environment 420Docs entry point may be offered; a fabricated application-specific route may not.

## Phase result

DOC-14.4 provides stable application-level contextual targets across the frozen user-facing inventory while retaining the authority, signing, economics, security, privacy and environment boundaries established by DOC-8, DOC-11, DOC-13 and DOC-14.1.
