# HZ-GCA-1.1 — 420Hz Generate / Community / Awards product boundaries

Status: **IMPLEMENTED — Level 1 boundary definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable authority map:

`hz/config/gca-product-boundaries-v1.json`

This document freezes the application/product boundary for the Generate, Community and Awards expansion. It deliberately does **not** complete HZ-GCA-1 as a whole. Object schemas, lifecycle, privacy, economics, moderation, threat modeling and interface contracts remain later HZ-GCA-1.x work packages.

## Baseline and authority

The boundary decision was reconciled against current `main` at:

`537525ebc636eabc76ff261f5b5ff5d236869b32`

The active roadmap branch is:

`feature/420hz-generate-community-awards-roadmap`

Repository truth controls. No live deployment, provider, fixed address or testnet readiness is inferred by this document.

## Core decision

**420Hz is the music product/application layer. It owns user-facing orchestration and 420Hz-specific product state. It does not absorb canonical authority from the systems it integrates.**

The product path is:

`Generate intent → 420AI request semantics → ComputeMarket execution → reviewed result → Creative Protocol registration/publication → Indexer/Search discovery → Community/Awards participation`

Each arrow crosses a trust boundary. A successful upstream step never silently authorizes the next authority domain.

## Authority matrix

| System | Canonical authority retained by that system | 420Hz may do | 420Hz must not do |
| --- | --- | --- | --- |
| 420 Wallet / SmartAccount | signing, account execution, sessions/capabilities, spending authorization | request reviewed actions and consume authorization results | treat connection as signing/spending permission |
| 420Identity | optional pseudonymous profiles, issuers, credentials and validity | consume optional public/credential assertions when policy requires | manufacture identity assurance or legal identity |
| 420AI | model/version identity, AI request constraints, privacy/verification policy, AI result commitments/lifecycle | translate Generate intent into bounded AI requests | create a second model/provider/request/result authority |
| 420 ComputeMarket | provider/node/resource/offers/requests/matches/jobs/receipts/verification/economic entitlement | consume qualified compute execution | become matcher, worker, verifier, escrow or settlement authority |
| 420 Creative Protocol | CreatorProfile, Work, Recording, contributors, rights, authorization, licenses, royalty schedules/settlement | register a reviewed output through canonical publication flows | infer ownership/permission/publication from generation success |
| 420Pay | invoice/payment identity and lifecycle, bounded settlement authorization, refunds/accounting | use canonical payment rails when product flows require payment/prizes | create alternate payment finality/refund/spending authority |
| 420ResourceProtocol / 420Store | provider/service policy, storage/resource agreements, commitments, proofs and settlement control | store/reference draft and published artifacts | treat storage provider state, URLs or bytes as rights/identity authority |
| 420Indexer | rebuildable chain/protocol projection with provenance/finality context | read history/catalog/community/award projections | override canonical state when projections disagree |
| 420Search | replaceable discovery/ranking over qualified public projections | discovery, filters and search entry points | make ranking/trending canonical truth |
| 420Notifications | opt-in presentation/delivery state | deliver alerts with source provenance | sign, spend or mutate originating state |
| 420Commons | community space/channel membership and roles | integrate shared spaces/channels if later adopted | make follows/favorites/playlists alternate Commons membership authority |
| 420Governance / Civic | governed policy mutation and delayed execution | consume explicitly governed policy | turn ordinary generation/social/award voting into protocol-governance authority |
| 420Arbitration | domain policy, cases, evidence, resolver/ruling/appeal/finality coordination | route eligible disputes and consume finalized rulings | bypass the origin protocol's remedy/accounting/authorization checks |
| 420Registry / ProtocolRegistry | service/component publication, versioning and discovery metadata | resolve approved deployed dependencies | treat discovery as mutation/payment/rights/governance authorization |

## 420Hz-owned product state

At this boundary stage, 420Hz may own only application/product state that does not duplicate another protocol's canonical state, including:

- replaceable Generate/Community/Awards presentation and orchestration;
- private draft/project metadata and UI preferences;
- mappings from 420Hz project state to canonical AI/compute/creative object references;
- explicit user review and **Register & Publish** intent;
- 420Hz-specific follows/favorites/playlists/activity records, provided they do not redefine 420Commons spaces/channels;
- future 420Hz Awards program/season/category/nomination/ballot/result records, limited to the product-domain authority defined in later roadmap work.

The exact object schemas and lifecycle rules are intentionally deferred to HZ-GCA-1.2 onward.

## Hard no-escalation invariants

1. Wallet connection never grants signing, spending or protocol mutation authority.
2. A 420Hz generation draft is not a 420AI request until accepted by 420AI.
3. A successful AI request is not a ComputeMarket verification/settlement result unless the canonical compute path says so.
4. Successful generation never implies Work/Recording registration, publication, ownership, derivative permission or royalty entitlement.
5. Creative Protocol transformation permission remains distinct from AI training permission.
6. 420Hz cannot fabricate payment, compute settlement or refund state.
7. Private prompts, draft lyrics/audio/stems and provider credentials are not public Indexer/Search inputs.
8. Indexer/Search/charts/analytics remain rebuildable derived views.
9. Notifications are presentation only.
10. 420Commons retains community-space/channel membership authority.
11. Governance cannot fabricate generation, rights, award votes or historical award results.
12. Arbitration rulings do not execute remedies by bypassing the origin protocol.
13. ProtocolRegistry discovery never confers runtime mutation authority.
14. 420Hz Awards voting is product-domain voting and is never interchangeable with Civic governance voting.

These are mirrored as `HZGCA-BND-001` through `HZGCA-BND-014` in the machine-readable manifest.

## Authoritative vs derived state

### Authoritative

Authority remains with the owning canonical systems:

- SmartAccount/account authorization;
- Identity profile/credential state;
- 420AI model/request/result commitments;
- ComputeMarket execution/economic commitments;
- Creative Protocol Work/Recording/rights/license/royalty state;
- 420Pay payment/refund state;
- Resource/Storage agreements/proofs/settlement control;
- Commons space/channel membership;
- Civic governed policy/execution;
- Arbitration case/ruling/finality;
- ProtocolRegistry publication/discovery;
- future 420Hz Awards records only inside their explicitly defined product domain.

### Derived / replaceable

- 420Hz web rendering;
- cached project/generation read models;
- Indexer projections;
- Search rankings;
- charts/trending scores;
- notification delivery records;
- analytics/dashboards;
- award presentation pages/badges projected from canonical award result records.

Derived state may be rebuilt, invalidated, reorg-corrected or replaced without rewriting canonical protocol truth.

## Dependency direction

The intended dependency direction is one-way and bounded:

- **Wallet/Identity → 420Hz** for account authorization and optional identity assertions.
- **420Hz → 420AI → ComputeMarket** for AI work definition and execution.
- **420Hz → Creative Protocol** only after explicit user review/registration intent.
- **420Hz → Pay/Resource** for canonical payment/storage services where required.
- **Canonical protocols → Indexer → Search/Notifications** for read/discovery/delivery.
- **Governance** changes only explicitly governed policy.
- **Arbitration** coordinates disputes; owning protocols apply any final remedy.
- **Registry** resolves deployed service identity; it does not authorize application actions.

Reverse authority leakage is forbidden.

## Source reconciliation

This decision preserves the existing repository boundaries in:

- `docs/architecture/infrastructure/420ai-compute-infrastructure.md`
- `docs/420-COMPUTE-MARKET-V1-ARCHITECTURE.md`
- `contracts/src/creative/README.md`
- `docs/developers/wallet-and-smart-accounts.md`
- `docs/audit/420IDENTITY-COMPLETE-AUDIT-20260930.md`
- `docs/architecture/protocols/pay-token-exchange-bridge.md`
- `docs/audit/420RESOURCE-AUDIT-REPORT.md`
- `docs/420INDEXER.md`
- `docs/420SEARCH-GENESIS-CLOSEOUT.md`
- `docs/420NOTIFICATIONS.md`
- `docs/420-PULSE-V1-MODEL.md`
- `docs/architecture/decisions/GOV-AUDIT-1-AUTHORITY-DEPENDENCY-CANCELLATION.md`
- `docs/audit/420ARBITRATION-COMPLETE-AUDIT-20261004.md`
- `docs/420WALLET.md`

Notable preserved rules include:

- 420AI defines AI work; ComputeMarket defines execution/economic commitments.
- ComputeMarket remains provider-neutral.
- Creative rights remain separate from generation and distinguish transformation from training permission.
- Indexer/Search/Notifications remain non-authoritative.
- Commons remains community-space/channel authority.
- GovernanceTimelock/Civic remains governance authority.
- Arbitration coordinates rulings without acquiring blanket remedy authority.

## Security consequences

This boundary specifically prevents:

- hidden wallet/custody privileges in the Generate UI;
- AI-provider or Compute worker authority over rights/publication;
- publishing a generated result without explicit rights/registration review;
- social popularity rewriting rights, identity or award eligibility;
- product voting being confused with protocol governance;
- Search/chart ranking being treated as canonical truth;
- Notifications or Registry deep links bypassing Wallet authorization;
- Arbitration becoming a general-purpose asset/remedy executor.

## HZ-GCA-1.1 exit criteria

HZ-GCA-1.1 is complete when:

- every required dependency has exactly one explicit authority boundary;
- 420Hz-owned state is restricted to product/application scope;
- authoritative and derived state are separated;
- no-escalation invariants are machine-verifiable;
- no live deployment/provider/fixed-address claim is invented;
- the targeted verifier passes on the exact implementation SHA.

This does **not** close parent HZ-GCA-1. HZ-GCA-1.2 through HZ-GCA-1.20 remain open.
