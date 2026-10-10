# High Country — R01.1 launch scope and requirement assignment

Status: release-scope decision recorded; implementation is incomplete. This document defines the launch target and requirement assignments, not detailed mechanics or release qualification.

## Authority and approved decision

The repository root README, HC-PA progressive-access specification, HC-GP integration documents, phase PR records and the repository audit remain authoritative for their respective boundaries. On 2026-10-08 (America/Regina), the repository owner selected the **full social economy release**, approved wallet-optional core play and approved perks without stronger cultivation statistics or competitive scoring advantages. This decision supplements existing phase scope; it does not certify planned features as implemented or change frozen encodings.

Supporting sources: `../../README.md`, `HC-PA-PROGRESSIVE-ACCESS.md`, `HC-GAMING-PROTOCOL-REFERENCE.md`, `HC-GP-8-CLIENT-ACCESS-UX.md`, `REPOSITORY-AUDIT-20261009.md`, `RECONCILIATION-AND-BUILDOUT-ROADMAP.md`. Existing HC-1..HC-6, HC-PA, HC-GP and HC-7 identifiers are retained. Later phase numbers are not invented here: R04 work-package identifiers track those modules until the canonical phase map is reconciled.

## Launch definition

High Country launches as a browser-first cannabis cultivation and genetics game with a complete social economy. Smaller cultivation and economy builds are development milestones; they do not replace this launch scope. No audited requirement is deferred by this decision.

The core loop is obtain seeds or eligible clones → cultivate → harvest → inventory/products → use, manufacture or trade → reinvest and progress. Launch includes genetics inspection, mothers/cuttings, breeding, cultivation capacity and inputs, offline growth, harvest quality and provenance, equipment manufacturing and lifecycle, internal BUDS economy, skills/research/discovery/missions, markets, leases/licenses/rights, organizations/cooperatives and their governance, seasons/competitions and the Global 420 Cup. The adopted R01.6 baseline fixes harvest, grades, internal currency, ordinary market and base exhibition rules. Each later module must provide its detailed versioned content, recipes, prices, rewards and acceptance vectors under the retained R04 assignment before implementation acceptance; none is waived or numerically approved by the baseline.

Launch also requires the actual browser UI, onboarding, reliable persistence, authenticated shared services, SDK/indexing, deployment tooling, security remediation, documentation, live testnet acceptance and production operations. Access-policy simulations cannot substitute for browser/service/contract end-to-end journeys.

## Access and perks

**High Country's core gameplay and social economy are accessible without a connected wallet. Wallet connection unlocks explicitly defined blockchain and entitlement features without purchasing stronger cultivation statistics or competitive scoring advantages.**

| Mode | Launch boundary |
|---|---|
| Guest, no wallet/account | Start ordinary play, cultivation/genetics/progression and local saving without registration or wallet prompts blocking core actions |
| Authenticated game account, no wallet | Shared social/economy participation, persistent organizations, authoritative competitive results and account/cloud services; account authentication may be required for shared state, wallet authentication may not |
| Wallet connected | Approved canonical ownership/provenance, eligible migration, supported on-chain transactions, optional entitlement content/events and scoped ecosystem interoperability |

Wallet connection alone does not establish asset eligibility, account ownership, paid entitlement or permission. Exact perks/catalogues and issuance conditions are still specification work. No unconditional free reward, conversion between BUDS and native $420, asset minting from arbitrary local saves, cash payout or funded prize is promised here. Base social features and competitions remain accessible without a wallet; explicitly optional entitlement events/content may coexist with them. Wallet disconnection must not erase ordinary saves or revoke core play; rights to already-canonical assets still follow their actual ownership and contracts.

## Release acceptance

A new player can start without a wallet, complete the cultivation-to-product loop, progress and participate in the social economy through a game account where shared authentication is needed. Wallet users can complete each approved optional journey with real configured dependencies. Equal protected simulation inputs produce equal outcomes regardless of wallet state. Production shared outcomes are authoritative and replay-safe; disconnected/local saves cannot fabricate tradable assets or competitive results. Failures conserve resources and recover without duplicate harvests, migrations, settlements or claims.

All launch features must have implementation, meaningful tests, integration, user/operator/developer documentation and deployed acceptance. The chain-Genesis Gaming Protocol obligation remains separate from High Country's first-year full-game release. An explicit future owner-approved versioned scope change is required to defer any launch requirement.

## Complete requirement assignment

The audit's current status column is a historical implementation assessment, not a completion claim. Every row below is launch-required, including conditionally applicable financial security once settlement is specified. Canonical sources and detailed current implementation/tests/remediation remain in the audit matrix.

| Requirement | Audit status at scope baseline | Retained phase / buildout owner | Release assignment |
|---|---|---|---|
| HC-AUD-001 Canonical complete release scope | PARTIAL | R01.1–R01.7 | Launch required |
| HC-AUD-002 Domain-separated types/actions/modules | PARTIAL | HC-1; R02 / R07 | Launch required |
| HC-AUD-003 Capability authorization | PARTIAL | HC-1; R02 / R07 | Launch required |
| HC-AUD-004 Complete six Genesis roots | COMPLETE | HC-1; R02 / R07 | Launch required |
| HC-AUD-005 Genesis finalization one-way | COMPLETE | HC-1; R02 / R07 | Launch required |
| HC-AUD-006 Ruleset content identity | COMPLETE | HC-1; R02 / R07 | Launch required |
| HC-AUD-007 Module lifecycle | PARTIAL | HC-1; R02 / R07 | Launch required |
| HC-AUD-008 Emergency allowlist | COMPLETE | HC-1; R02 / R07 | Launch required |
| HC-AUD-009 Emergency effective stop/recovery | MISSING | HC-1; R02 / R07 | Launch required |
| HC-AUD-010 Three founding regions | COMPLETE | HC-2; R02 / R07 | Launch required |
| HC-AUD-011 World readiness | PARTIAL | HC-2; R02 / R07 | Launch required |
| HC-AUD-012 Persistent one-per-account grower | COMPLETE | HC-2; R02 / R07 | Launch required |
| HC-AUD-013 Land identity/capacity | COMPLETE | HC-3; R02 | Launch required |
| HC-AUD-014 Genesis parcel Merkle membership | COMPLETE | HC-3; R02 | Launch required |
| HC-AUD-015 Occupancy state consistency | PARTIAL | HC-3; R02 | Launch required |
| HC-AUD-016 Public capacity/allocation | COMPLETE | HC-3; R02 | Launch required |
| HC-AUD-017 Public allocation cultivation | MISSING | HC-3; R02 | Launch required |
| HC-AUD-018 Immutable 28-locus genomes | COMPLETE | HC-4; R02 / R07 | Launch required |
| HC-AUD-019 Sixteen founding lines | PARTIAL | HC-4; R02 / R07 | Launch required |
| HC-AUD-020 Seed provenance/quantity | PARTIAL | HC-4; R02 / R07 | Launch required |
| HC-AUD-021 Clone-to-mother consistency | COMPLETE | HC-4; R02 / R07 | Launch required |
| HC-AUD-022 Finite mother budget | PARTIAL | HC-4; R02 / R07 | Launch required |
| HC-AUD-023 Permanent phenotype provenance | PARTIAL | HC-4; R02 / R07 | Launch required |
| HC-AUD-024 Domain/requester/context single entropy use | COMPLETE | HC-5; R02 | Launch required |
| HC-AUD-025 Fair/available randomness | PARTIAL | HC-5; R02 | Launch required |
| HC-AUD-026 Immutable breeding provenance | COMPLETE | HC-5; R02 | Launch required |
| HC-AUD-027 Pending breeding recovery | MISSING | HC-5; R02 | Launch required |
| HC-AUD-028 Plant identity/forward stage/capacity | COMPLETE | HC-6; R02 | Launch required |
| HC-AUD-029 Deterministic offline timed growth | COMPLETE | HC-6; R02 | Launch required |
| HC-AUD-030 Six controls/bounds/rounding | COMPLETE | HC-6; R02 | Launch required |
| HC-AUD-031 Sealed expression/no reroll | PARTIAL | HC-6; R02 | Launch required |
| HC-AUD-032 Harvest/product grading | MISSING | HC-7; R03 | Launch required |
| HC-AUD-033 Equipment/manufacturing/lifecycle | MISSING | R04.2–R04.4 | Launch required |
| HC-AUD-034 BUDS and economic settlement | MISSING | R04.1 / R04.5 | Launch required |
| HC-AUD-035 Skills/research/discovery/missions | MISSING | R04.6–R04.7 | Launch required |
| HC-AUD-036 Marketplace/ownership/payment | MISSING | R04.8 | Launch required |
| HC-AUD-037 Lease/license/rights | MISSING | R04.9 | Launch required |
| HC-AUD-038 Organizations/cooperatives/governance | MISSING | R04.10–R04.11 | Launch required |
| HC-AUD-039 Seasons/competition/Global 420 Cup | MISSING | R04.12–R04.13 | Launch required |
| HC-AUD-040 Wallet-free core; no stat advantage | PARTIAL | HC-PA / HC-GP; R02 / R05 / R06 | Launch required |
| HC-AUD-041 Local/service/canonical split | PARTIAL | HC-PA / HC-GP; R02 / R05 / R06 | Launch required |
| HC-AUD-042 Guest/profile single binding | COMPLETE | HC-PA / HC-GP; R02 / R05 / R06 | Launch required |
| HC-AUD-043 Eligible object single consumption | PARTIAL | HC-PA / HC-GP; R02 / R05 / R06 | Launch required |
| HC-AUD-044 Routine zero-value exact sessions | PARTIAL | HC-PA / HC-GP; R02 / R05 / R06 | Launch required |
| HC-AUD-045 Sensitive wallet escalation | PARTIAL | HC-PA / HC-GP; R02 / R05 / R06 | Launch required |
| HC-AUD-046 Shared entitlement identity/content | COMPLETE | HC-GP; R02 / R05 / R06 | Launch required |
| HC-AUD-047 Shared game-profile binding | COMPLETE | HC-GP; R02 / R05 / R06 | Launch required |
| HC-AUD-048 Consumed migration claim binding | COMPLETE | HC-GP; R02 / R05 / R06 | Launch required |
| HC-AUD-049 Cross-instance save migration | PARTIAL | HC-GP; R02 / R05 / R06 | Launch required |
| HC-AUD-050 Bonus region optional access | PARTIAL | HC-GP; R02 / R05 / R06 | Launch required |
| HC-AUD-051 Optional event access | PARTIAL | HC-GP; R02 / R05 / R06 | Launch required |
| HC-AUD-052 Scoped cross-game subjects/revocation | PARTIAL | HC-GP; R02 / R05 / R06 | Launch required |
| HC-AUD-053 Registered/cloud save/account proof | PARTIAL | Shared Gaming; R05 | Launch required |
| HC-AUD-054 Query freshness/reorg/indexing | PARTIAL | Shared Gaming; R05 | Launch required |
| HC-AUD-055 Real browser workflows | MISSING | R06 | Launch required |
| HC-AUD-056 RPC/wallet/chain configuration | MISSING | HC-GP; R05 / R06 / R07 | Launch required |
| HC-AUD-057 Reproducible production builds | PARTIAL | R08 | Launch required |
| HC-AUD-058 Security/dependency qualification | PARTIAL | R02 / R08 | Launch required |
| HC-AUD-059 HC deploy/seed/grants/manifests | MISSING | R07 | Launch required |
| HC-AUD-060 Shared testnet runtime | BLOCKED | Shared Gaming; R09 | Launch required |
| HC-AUD-061 User/operator/developer docs | PARTIAL | R01 / R08 / R10 | Launch required |
| HC-AUD-062 Exact final-head evidence | BLOCKED | R08 / R09 / R10 | Launch required |
| HC-AUD-063 Production operations | MISSING | R10 | Launch required |
| HC-AUD-064 Upgrade/migration execution | PARTIAL | HC-1 module lifecycle; R01.5 / R04.14 / R07 | Launch required |
| HC-AUD-065 Custody/allowance/bridge/oracle prices | NOT APPLICABLE | R01.5 / R04.5 / R04.8 / R08 | Launch security review required; individual custody/bridge/oracle paths conditional on approved mechanics |

## Accumulated R01 specification records

R01.2 freezes authority/component/service boundaries; R01.3 reconciles enums/units/access states; R01.4 specifies both migration flows; R01.5 defines privileges, randomness, emergencies, account provenance, custody and upgrades; R01.6 specifies gameplay parameters, BUDS/settlement semantics, optional perks and competition rules. R01.7 performs the accumulated Level 2 specification milestone review. R01.1 alone does not close those steps. See the R01.7 milestone review for their accumulated qualification and remaining module/deployment prerequisites.

## R01.1 Level 1 verification

Documentation-only step: verify all 65 unique audit IDs are assigned exactly once, no phase identifier is renumbered, references resolve, required feature groups and wallet/account separation are explicit, no unapproved deferral or readiness claim is introduced, and patch whitespace is clean. Source contracts/services/client behavior is unchanged. Foundation qualification remains attached to its earlier exact implementation SHA; no global or Solidity rerun is required for this scope document.
