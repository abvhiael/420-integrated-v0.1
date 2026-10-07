# Budtender repository audit — 2026-10-07

## Scope and authority

Repository: `abvhiael/420-integrated-v0.1`

Audit base: `main` at `c8e8b58d818611276f7a9bb2b8d2241004450d97`.

This audit treats repository state as authoritative. The current canonical Budtender gameplay definition consists of BUD-0 through BUD-4 plus the shared 420 Gaming Protocol integration contract. No BUD-5 or later Budtender phase specification or canonical Budtender roadmap exists on the audited `main`; later product domains named by BUD-0 therefore remain architecture targets rather than implemented/qualified requirements.

## Canonical sources reviewed

- `docs/budtender/BUD-0-ARCHITECTURE.md`
- `docs/budtender/BUD-0-CHECKLIST.md`
- `docs/budtender/BUD-1.md`
- `docs/budtender/BUD-1-SPEC.md`
- `docs/budtender/BUD-1-CHECKLIST.md`
- `docs/budtender/BUD-2-SPEC.md`
- `docs/budtender/BUD-3-SPEC.md`
- `docs/budtender/BUD-4-SPEC.md`
- `src/budtender/README.md`
- `docs/gaming/420GP-12-BUDTENDER.md`
- `docs/gaming/420GP-9-RUNTIME-WIRING.md`
- `docs/gaming/420GP-15-LIVE-TESTNET.md`
- `docs/gaming/420GP-16-SECURITY-PRIVACY.md`
- `contracts/config/420gamingprotocol-genesis.json`
- `contracts/config/genesis-dapp-contract-map.json`
- `deployments/gaming/testnet.runtime.json`
- Budtender source/tests, shared Gaming Protocol source/tests, and Budtender qualification workflow.

## Architecture found

Budtender is currently a deterministic TypeScript simulation core plus an optional shared Gaming Protocol access adapter.

The integrated gameplay authority is:

1. `BudtenderStore` — BUD-1 order/store façade.
2. `BudtenderCustomerSystem` — BUD-2 customer lifecycle.
3. `ProductInventory` — BUD-3 product/catalog/inventory authority.
4. `StoreProgression` — BUD-4 internal cash, upgrades and expansion authority.
5. `clients/budtender-access-v1` — optional guest/registered/wallet-linked access policy using the shared Gaming SDK.

Budtender has no app-specific smart contract. Canonical chain state for optional ecosystem features belongs to the shared 420 Gaming Protocol. Game-specific mechanics and ordinary progression remain off-chain.

No production mobile UI, cloud-save service, app-specific API/backend/indexer, database, save migration implementation, or Budtender production deployment package is present.

## Remediation performed

The audited `main` had four material repository-quality gaps:

1. Budtender TypeScript tests were not included in the dedicated Budtender workflow and were not directly executable with the documented repository toolchain.
2. `BudtenderStore` duplicated product inventory and cash/upgrade state already modeled by BUD-3 and BUD-4.
3. BUD-1 restocking accepted arbitrary caller-provided unit prices instead of the canonical BUD-3 catalog wholesale price.
4. Numeric economy operations lacked explicit safe-integer overflow guards.

The audit branch:
- makes TypeScript imports directly executable under Node 22 native type stripping;
- makes the dedicated workflow run BUD-1 through BUD-4 core tests, shared Gaming SDK/access tests and shared Gaming Protocol adversarial Solidity tests;
- makes `ProductInventory` authoritative for starter product inventory/economics;
- makes `StoreProgression` authoritative for internal cash/upgrades;
- preserves the BUD-1 façade while delegating to BUD-3/BUD-4;
- binds restocking to canonical catalog wholesale prices;
- adds cross-phase integration tests;
- adds safe-integer/atomicity guards and boundary tests;
- adds BUD-AUDIT-5 deterministic bounded offline progression with replay/rollback protections;
- adds BUD-AUDIT-6 application service authority boundary over store/customer/progression/offline evaluation;
- adds BUD-AUDIT-7 responsive user-facing browser client over the application service;
- adds BUD-AUDIT-8 user-facing Gaming Protocol policy/status integration over the existing shared access client;
- documents the actual current release boundary.

## File inventory

| Component | Repository path | Status | Notes |
|---|---|---|---|
| Architecture freeze | `docs/budtender/BUD-0-ARCHITECTURE.md` | COMPLETE | Canonical architecture and invariants |
| BUD-0 checklist | `docs/budtender/BUD-0-CHECKLIST.md` | COMPLETE | Frozen architecture checklist |
| BUD-1 spec/checklist | `docs/budtender/BUD-1*` | COMPLETE | Implementation status and exact-head merge-gate wording reconciled |
| BUD-2 spec | `docs/budtender/BUD-2-SPEC.md` | COMPLETE | Implementation status reconciled; exact-head qualification remains merge gate |
| BUD-3 spec | `docs/budtender/BUD-3-SPEC.md` | COMPLETE | Implementation status reconciled; exact-head qualification remains merge gate |
| BUD-4 spec | `docs/budtender/BUD-4-SPEC.md` | COMPLETE | Implementation status added; exact-head qualification remains merge gate |
| Store façade | `src/budtender/BudtenderStore.ts` | COMPLETE | Integrated BUD-1 façade after remediation |
| Customer system | `src/budtender/BudtenderCustomers.ts` | COMPLETE | Deterministic tick lifecycle |
| Product/inventory | `src/budtender/ProductInventory.ts` | COMPLETE | Canonical BUD-3 inventory/economics |
| Progression | `src/budtender/StoreProgression.ts` | COMPLETE | Canonical BUD-4 cash/upgrade/expansion state |
| Offline progression | `src/budtender/OfflineProgression.ts` | COMPLETE | 24-hour bounded, replay-safe, chain-independent calculation; exact-head Level 1 qualified |
| Application service | `src/budtender/BudtenderApplicationService.ts` | COMPLETE | Authoritative command + detached snapshot boundary; exact-head Level 1 qualified |
| User-facing web client | `clients/budtender-web-v1` | COMPLETE | Responsive presentation client over application service; exact-head Level 1 qualified |
| BUD-AUDIT-7 spec | `docs/budtender/BUD-AUDIT-7-USER-FACING-CLIENT.md` | COMPLETE | Client requirements/invariants frozen and exact-head Level 1 qualified |
| BUD-AUDIT-8 spec | `docs/budtender/BUD-AUDIT-8-GAMING-PROTOCOL-INTEGRATION.md` | IMPLEMENTED | Gaming Protocol integration requirements/invariants frozen; qualification pending |
| BUD-AUDIT-6 spec | `docs/budtender/BUD-AUDIT-6-APPLICATION-SERVICE.md` | COMPLETE | Application-service requirements/invariants frozen and exact-head Level 1 qualified |
| BUD-AUDIT-5 spec | `docs/budtender/BUD-AUDIT-5-OFFLINE-PROGRESSION.md` | COMPLETE | Audit-phase requirements frozen and Level 1 exact-head qualification recorded |
| Core unit tests | `test/budtender/*.spec.ts` | COMPLETE | Includes negative/boundary and cross-phase integration tests |
| Gaming access client | `clients/budtender-access-v1` | IMPLEMENTED | Shared SDK consumer; canonical integration metadata and app-facing policy wiring added; exact-head qualification pending |
| Dedicated CI | `.github/workflows/budtender-gaming.yml` | COMPLETE | Exact-head core/access/contract-security qualification |
| Budtender smart contracts | none | NOT APPLICABLE | Architecture requires game mechanics off-chain; shared protocol owns optional canonical state |
| Mobile/presentation client | `clients/budtender-web-v1` | PARTIAL | Responsive user-facing browser client implemented; packaged native iOS/Android and production hosting are not yet provided |
| Guest save/persistence | none | MISSING | BUD-ARCH-010 requires versioned migration-aware saves before production |
| Registered cloud save | none | MISSING | Architecture target; no implementation |
| Budtender backend/API/indexer | none | NOT APPLICABLE | No BUD-0..4 requirement; no canonical service design |
| Database/schema/migrations | none | NOT APPLICABLE | No current server persistence implementation |
| App-specific deployment scripts | none | NOT APPLICABLE | Current core is local simulation; shared protocol has its own deployment tooling |
| Shared protocol runtime | `deployments/gaming/testnet.runtime.json` | BLOCKED | Chain/contracts/operators unresolved until live deployment |

## Smart-contract audit

Budtender itself requires no game-specific contract under BUD-0 through BUD-4. The shared Genesis Gaming Protocol contains:

- `GamingIds420.sol`
- `GamingAuthorization420.sol`
- `GameRegistry420.sol`
- `GameIdentity420.sol`
- `GameEntitlements420.sol`
- `GameClaims420.sol`
- `CrossGameRegistry420.sol`

These are shared protocol infrastructure. Their authorization, replay/revocation, namespace isolation and authority boundaries are covered by `GamingProtocol420*.t.sol` and the GP-16 hardening workflow. Budtender does not custody on-chain funds, execute arbitrary calls, implement signatures/nonces, bridge messages, or consume an oracle in the audited gameplay slice, so those smart-contract-specific checks are not applicable to the Budtender core.

Live deployment remains blocked because the testnet runtime has null chain ID, contract addresses and operator addresses.

## Security findings

### Verified/mitigated
- Core management remains wallet-free.
- Customer/order settlement is single-use.
- Inventory and cash fail closed on insufficiency.
- Restock capacity is bounded.
- Product and cash arithmetic is constrained to JavaScript safe integers.
- Sale overflow is rejected before inventory/cash mutation.
- Caller-supplied restock prices cannot override the canonical catalog.
- BUD-1/BUD-3/BUD-4 no longer maintain competing authoritative cash/inventory state.
- Unknown access features fail closed.
- Optional wallet access is scoped by the canonical Budtender game namespace.
- Shared Gaming Protocol authority remains outside the game core.

### Accepted current-stage design risk
The gameplay core is in-memory and single-process. It does not yet implement durable persistence, save migration, cloud synchronization, concurrency control or crash recovery. BUD-AUDIT-5 now provides a deterministic bounded offline-progression calculator, but no existing BUD-1..4 subsystem is canonically offline-capable and no durable save layer yet owns the trusted offline cursor/source state. This is acceptable for the current audit step, not for production exposure.

### Unresolved release risk
Live Gaming Protocol operator/contract bindings are not deployed/qualified in the checked-in runtime. Production save/persistence, production hosting and packaged native mobile delivery remain unresolved.

## Integration classification

| Ecosystem component | Status | Basis |
|---|---|---|
| 420 Gaming Protocol | PARTIAL | Repository integration implemented; live runtime deployment pending |
| 420 Wallet / SmartAccount / CapabilityRegistry | PARTIAL | Optional authority boundary provided through shared SDK; live deployment pending |
| 420Identity | NOT APPLICABLE | Budtender uses GameIdentity420 for game profiles; no direct Identity420 dependency is specified |
| High Country | PARTIAL | Explicit entitlement/reference boundary specified; no live cross-game deployment qualification |
| Registry/Names/Pay/Token/Stake/Governance/Treasury/Bridge/AI/Compute/Notifications/Analytics/Verify/Rights/Arbitration/Storage/Oracle | NOT APPLICABLE | No direct dependency is defined by BUD-0..4 or GP-12 |

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| BUD-ARCH-001 wallet-free core | BUD-0 | Core has no wallet dependency | Core + access tests | BUD-0/GP-12 | COMPLETE | None |
| BUD-ARCH-002 internal ordinary economy | BUD-0 | StoreProgression internal cash | Core/integration | BUD-0/BUD-4 | COMPLETE | None |
| BUD-ARCH-003 adapter-based optional wallet | BUD-0 | budtender-access-v1/shared SDK | access tests | GP-12 | COMPLETE | Live runtime qualification |
| BUD-ARCH-004 no High Country live-state copy | BUD-0 | No HC simulation import | source inspection | BUD-0 | COMPLETE | None |
| BUD-ARCH-005 cross-game entitlement/reference only | BUD-0 | shared SDK/protocol boundary | shared cross-game tests | GP-12/GP-14 | COMPLETE | Live runtime qualification |
| BUD-ARCH-006 registered cloud save without wallet | BUD-0 | Access policy permits registered/no-wallet | access tests | BUD-0/GP-12 | PARTIAL | Implement cloud-save persistence |
| BUD-ARCH-007 wallet disconnect preserves progression | BUD-0 | Core independent of wallet | hostile access/shared tests | BUD-0/GP-16 | COMPLETE | Persistence-layer regression when added |
| BUD-ARCH-008 bounded deterministic offline progression | BUD-0 / BUD-AUDIT-5 | `OfflineProgression` pure domain calculator; 24h bound; replay/rollback protections; current BUD-1..4 remain offline-inert | offline boundary/adversarial tests | BUD-0 / BUD-AUDIT-5 | COMPLETE | Qualified on implementation SHA `c619c3fecbbb17ae34303209b908e78844d48051`; persistence must later own trusted cursor/source state before production exposure |
| BUD-ARCH-009 UI not authoritative | BUD-0 / BUD-AUDIT-7 | Browser client renders detached application snapshots and sends sanctioned commands only | web-client API/authority tests | BUD-0 / BUD-AUDIT-7 | COMPLETE | Qualified on `9961bf25b7ee7d0fb750cfdbb6676d7fdc01d1ec`, run `37670777590` |
| BUD-ARCH-010 versioned/migration-aware saves | BUD-0 | No save format/migration | none | BUD-0 | MISSING | Implement before production |
| BUD-INV-001 no negative inventory | BUD-1 | ProductInventory bounds | BUD-1/BUD-3 tests | BUD-1 | COMPLETE | None |
| BUD-INV-002 order served once | BUD-1 | served flag | BUD-1/BUD-2 tests | BUD-1 | COMPLETE | None |
| BUD-INV-003 unknown/unavailable product fails closed | BUD-1 | mapping/inventory validation | BUD-1/BUD-2 tests | BUD-1 | COMPLETE | None |
| BUD-INV-004 valid sales only/no overspend | BUD-1 | progression cash authority | core/integration/boundary | BUD-1 | COMPLETE | None |
| BUD-INV-005 restock <= capacity | BUD-1 | precheck + ProductInventory | BUD-1/BUD-3 tests | BUD-1 | COMPLETE | None |
| BUD-INV-006 bounded upgrade levels | BUD-1 | StoreProgression maxima | BUD-1/BUD-4 tests | BUD-1/BUD-4 | COMPLETE | None |
| BUD-INV-007 guest has no chain dependency | BUD-1 | pure TS core | core/access tests | BUD-1/GP-12 | COMPLETE | None |
| BUD-CUST-001 unique customer IDs | BUD-2 | map duplicate guard | customer tests | BUD-2 | COMPLETE | None |
| BUD-CUST-002 stable arrival ordering | BUD-2 | arrivalSequence sort | customer tests | BUD-2 | COMPLETE | None |
| BUD-CUST-003 patience non-negative | BUD-2 | clamp to zero | customer tests | BUD-2 | COMPLETE | None |
| BUD-CUST-004 terminal serve/abandon once | BUD-2 | status guards | customer tests | BUD-2 | COMPLETE | None |
| BUD-CUST-005 abandoned cannot settle | BUD-2 | abandoned guard | customer tests | BUD-2 | COMPLETE | None |
| BUD-CUST-006 serve settles matching order once | BUD-2 | bound orderId -> store | customer/integration | BUD-2 | COMPLETE | None |
| BUD-CUST-007 rush profile cannot mutate economy | BUD-2 | profile setter only | customer tests | BUD-2 | COMPLETE | None |
| BUD-CUST-008 wallet/account/chain independent | BUD-2 | no adapter imports | tests/source | BUD-2 | COMPLETE | None |
| BUD-PROD-001 stable unique product IDs | BUD-3 | map + duplicate guard | inventory tests | BUD-3 | COMPLETE | None |
| BUD-PROD-002 stock non-negative | BUD-3 | consume guard | inventory tests | BUD-3 | COMPLETE | None |
| BUD-PROD-003 stock <= capacity | BUD-3 | restock guard | inventory tests | BUD-3 | COMPLETE | None |
| BUD-PROD-004 locked product cannot stock/consume | BUD-3 | unlocked guards | inventory tests | BUD-3 | COMPLETE | None |
| BUD-PROD-005 non-negative integer economics | BUD-3 | safe-integer validation | inventory boundary tests | BUD-3 | COMPLETE | None |
| BUD-PROD-006 wholesale <= sale starter catalog | BUD-3 | definition validation | inventory tests | BUD-3 | COMPLETE | None |
| BUD-PROD-007 demand 0..100 integer | BUD-3 | definition validation | inventory tests | BUD-3 | COMPLETE | None |
| BUD-PROD-008 wallet/chain independent | BUD-3 | pure domain service | source/tests | BUD-3 | COMPLETE | None |
| BUD-UPG-001 levels <= max | BUD-4 | max-level guard | progression tests | BUD-4 | COMPLETE | None |
| BUD-UPG-002 deterministic non-negative costs | BUD-4 | fixed integer formulas | progression tests | BUD-4 | COMPLETE | None |
| BUD-UPG-003 purchases never negative cash | BUD-4 | cash guard | progression tests | BUD-4 | COMPLETE | None |
| BUD-UPG-004 failed purchase atomic | BUD-4 | prevalidation | progression tests | BUD-4 | COMPLETE | None |
| BUD-UPG-005 expansion prerequisite order | BUD-4 | canonical order | progression tests | BUD-4 | COMPLETE | None |
| BUD-UPG-006 expansion unlock once | BUD-4 | set duplicate guard | progression tests | BUD-4 | COMPLETE | None |
| BUD-UPG-007 wallet/account/chain independent | BUD-4 | pure domain service | source/tests | BUD-4 | COMPLETE | None |
| Core gameplay no pay-to-win wallet benefit | GP-12/GAME-INV-010 | access client exposes optional feature gates only | access + shared hostile tests | GP-12/GP-16 | COMPLETE | Preserve in future gameplay |
| Canonical game namespace | GP-12 | BUDTENDER_GAME_ID | access/shared tests | GP-12 | COMPLETE | Live registry verification |
| No parallel wallet/session authority | GP-12 | shared SDK only | shared protocol tests | GP-12 | COMPLETE | None |
| Privacy-scoped game reads/no wallet-wide enumeration | GP-12/GP-16 | shared SDK/query model | shared cross-game/hardening | GP-14/16 | COMPLETE | Live verification |
| Shared protocol runtime resolved | GP-9/GP-15 | checked-in manifest unresolved | live harness exists | GP-15 | BLOCKED | Deploy testnet and populate verified runtime |
| Budtender operator binding live | GP-15 | operator null | registry journey exists | GP-15 | BLOCKED | Supply/deploy operator and verify registry |
| User-facing production client | BUD-0 / BUD-AUDIT-7 | Responsive browser client implemented over application service | web-client host/API tests | BUD-AUDIT-7 | PARTIAL | Exact-head Level 1 qualification; packaged native delivery/production hosting remain later release work |
| Durable versioned saves | BUD-0 persistence | absent | none | architecture only | MISSING | Specify/implement/migration-test |
| Registered cloud save | BUD-0 persistence | absent | access gating only | architecture only | MISSING | Implement service and recovery tests |

## Release-stage determination

The correct repository-grounded interpretation is:

- BUD-0 architecture: complete.
- BUD-1..BUD-4 deterministic simulation slice: implemented and remediated.
- BUD-AUDIT-5 offline progression boundary: complete and exact-head Level 1 qualified on `c619c3fecbbb17ae34303209b908e78844d48051`.
- BUD-AUDIT-6 application service boundary: complete and exact-head Level 1 qualified on `b80eb03b50526f470e3a8b778dc0329a27d95ef1`.
- BUD-AUDIT-7 user-facing client: complete and exact-head Level 1 qualified on `9961bf25b7ee7d0fb750cfdbb6676d7fdc01d1ec`.
- BUD-AUDIT-8 Gaming Protocol integration: implemented; exact-head qualification pending.
- Shared Gaming Protocol source integration: implemented.
- Live Gaming Protocol deployment: pending.
- User-facing browser client: implemented; full production/mobile release remains incomplete.
- Production release: not ready.

A green repository test run does not change the missing persistence, mobile client or unresolved live deployment facts.
