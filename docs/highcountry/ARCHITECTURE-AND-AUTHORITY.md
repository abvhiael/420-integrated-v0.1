# High Country — R01.2 architecture and authority

Status: normative architecture specification for the approved full social economy release. Existing foundations are partial implementations; this document does not certify missing services, frontend or deployment. Scope: R01.2, Level 1; accumulated specification milestone remains R01.7.

## Sources and precedence

[Release scope](RELEASE-SCOPE.md), [HC-PA](HC-PA-PROGRESSIVE-ACCESS.md), [Gaming integration](HC-GAMING-PROTOCOL-REFERENCE.md), [session authority](HC-GP-4-SESSION-CAPABILITY.md), [migration](HC-GP-5-GUEST-MIGRATION.md), [cross-game privacy](HC-GP-7-CROSS-GAME-ATTESTATIONS.md), [audit](REPOSITORY-AUDIT-20261009.md), and [roadmap](RECONCILIATION-AND-BUILDOUT-ROADMAP.md) define the boundaries. Existing contract encodings/storage remain authoritative for deployed-compatible V1 semantics; R01.3 reconciles schema/version differences. The owner-approved R01.1 scope adds wallet-free social economy participation without demoting existing canonical registries.

## Component map

| Component | Responsibility and authoritative writes | Present implementation / delivery owner |
|---|---|---|
| Browser game | Render, input, guest simulation and versioned local saves; display verified service/chain results; never authorize shared assets from client claims | Access-policy library only: `clients/highcountry-access-v1`; playable frontend missing, R06 |
| Authenticated profile/save service | Conventional account authentication, consent, profile scope, durable cloud saves/recovery and proven optional wallet association | Process-local `services/420-gaming-player-profile` foundation; durable authenticated API missing, R05 |
| HC authoritative game service | Validate registered shared progression, internal inventory/BUDS, ordinary market, organizations and base competitions under versioned rules | Missing; R04/R05; local previews never finalize shared economy/results |
| Migration worker | Eligible object validation, durable unique operation, transaction/outbox and finalized receipt reconciliation; no player key custody | Contract receipt/helpers exist; durable worker missing, R01.4/R05 |
| Event indexer/query | Derived read models, scoped reads, durable cursor/deduplication, reorg rollback and canonical finality verification | Injected `services/420-gaming-query` adapters only; production ingestion missing, R05 |
| Shared SDK / HC transport | Typed versioned payloads/ABIs, configured chain/address resolution, API/RPC adapters and transaction state; no independent authorization | `packages/420-gaming-sdk` foundation; HC ABI/bindings/real transports missing, R05/R06 |
| HC canonical contracts | Existing Genesis/ruleset/world/land/genetics/breeding/cultivation records and protected asset/provenance transitions | `contracts/src/highcountry`; 28 contracts audited; cross-module gaps R02, harvest R03, additional canonical systems R04 |
| Shared Gaming contracts | Game/operator registry, optional wallet game identity, targeted claims, scoped entitlements, cross-game attestations | `contracts/src/gaming`; consume through HC narrow bridge interfaces |
| Wallet / authorization | Player signing/execution, exact session grants, epoch/revocation, target-level capabilities | Existing SmartAccount/EntryPoint/CapabilityRegistry; HC does not create wallet or custody layer |
| Deployment / operations | Reproducible manifests, seed/grants/registration, role handoff, secrets, hosting, recovery and monitoring | HC package missing R07/R10; shared runtime unresolved |

## State authority map

| State class | Authoritative domain | Permitted writer / promotion boundary |
|---|---|---|
| Routine equipment, ordinary farm progression, common inventory, irrigation upgrades, local mission progress | LOCAL_GAME_STATE for guest play | Local simulation; untrusted for shared settlement or competitive evidence |
| Registered saves and cloud progression | REGISTERED_GAME_STATE | Authenticated service with account/game scope; browser submits intent, not authoritative balances |
| Shared internal economy, ordinary market orders, organization membership and base competitive outcomes | REGISTERED_GAME_STATE (planned extension) | HC service validates rules and serializes transactions; no wallet prerequisite |
| Registered cultivar, significant genetic lineage, championship result, marketplace asset, transferable seed/clone, cross-game asset, ecosystem reward, significant achievement, licensing right | CANONICAL_ECOSYSTEM_STATE | Specific canonical contracts and scoped capabilities; approved migration/issuance only |
| Existing HC Genesis, rulesets, module records, regions, GrowerProfile, land, genome, seed/mother/clone/phenotype, breeding and plant records | CANONICAL_ECOSYSTEM_STATE | Existing registry/engine authority preserved; local counterparts are separate simulation objects |
| Optional wallet profile, consumed claim, entitlement, attestation | CANONICAL_ECOSYSTEM_STATE | Shared Gaming registry authority, HC bridge validates identity/type/content/domain |
| Indexed/cache copies of canonical records | Derived, never authoritative | Indexer can replace/rollback projections; canonical finalized chain controls rights |

`HighCountryAccessPolicy.StateObject` encodes the first, second and canonical classes; new service object vocabulary is a specification extension, not an enum change in this step. Distinct domain-qualified IDs prevent a local plant, service plant and canonical PlantRegistry ID from being conflated. Serialization must carry authority domain, schema/ruleset version and immutable object identity; exact fields/units are R01.3. No raw save or conventional identifier is placed on-chain.

## Two markets and two competition boundaries

The existing `ProgressiveGamingTypes.Capability.MARKETPLACE` and HC-PA ECOSYSTEM_PARTICIPANT gate mean **canonical ecosystem asset trading**. The R01.1 wallet-free social economy additionally requires an **ordinary service market** for internal game assets/BUDS. These are separate authority/settlement domains; the ordinary market cannot transfer canonical ownership, fabricate tokens or convert BUDS into $420. API names and UI labels must distinguish them; R01.6 fixes integer internal BUDS without conversion and zero-fee full-fill ordinary trading; detailed ledger/settlement implementation remains R04.5/R04.8.

Base events and service competitive results are wallet-free for authenticated players. Optional entitlement events and canonical championship provenance have separate explicit eligibility/issuance boundaries. Wallet entitlement cannot alter protected yield, capacity, genetics quality, equipment stats, BUDS generation, ordinary progression or scoring. Canonical result recording does not independently prove fair gameplay; service evidence/anti-cheat and authorized issuer policy are required.

## Permissions and trust boundaries

| Principal | Allowed authority | Denied / required validation |
|---|---|---|
| Guest browser | Local play/save | Cannot issue canonical assets or trusted shared balances/results |
| Registered player | Scoped account actions through service | Other accounts/game scopes denied; caller-supplied wallet string is not proof |
| Wallet owner | Explicit canonical transaction and targeted claim consumption | Connection alone is not permission/entitlement; domain/nonce/expiry proof for service linking |
| Routine session key | Reviewed exact zero-value target/selector with current scope/epoch/grant | Native spend, transfers, settlement, grants and other sensitive actions escalate; unknown selectors fail closed |
| HC service/operator | Bounded approved game-domain writes/issuance under service roles and actual contract capabilities | No target-wallet claim consumption or private key custody; no implicit owner override beyond contract-authorized powers |
| Capability/admin authority | Exact module/action/scope grants and documented emergency/configuration powers | No unrestricted worker grant; R02.2 rejects periodic grants; real revocation wiring is qualified in R02.1 |
| Randomness provider | Exact request/domain/context fulfillment | Trusted entropy is not independently fair; proof/timeout/recovery decision R01.5/R02 |
| Indexer/query adapter | Scoped projection reads | Cannot grant rights based on self-reported finalized metadata; high-risk reads require canonical verification |

Existing capability administrators can authorize transitions without intrinsic owner checks in some contracts. This is an unresolved explicit trust boundary, not a player-owned-assets guarantee. Deployment provenance of SmartAccounts, trusted constructor dependencies, bounded operator roles and emergency consumers must be enforced before release. R01.5 specifies accepted powers; R02 implements enforcement.

## Dependency map and canonical resolution

| Dependency | Consumer / boundary | Verified scope / unresolved work |
|---|---|---|
| CapabilityRegistry420 | HighCountryAuthorization and session verifier | Direct dependency; exact component/action/scope/amount; nonperiodic-only policy R02.2; no cumulative metering |
| SmartAccount420 / EntryPoint420 | Optional wallet/session transport | Existing wallet execution; canonical provenance and approved selector catalogue required |
| GameRegistry420 / GamingAuthorization420 | Shared operator registration/issuance | Shared protocol authorization; no HC domain logic added to shared storage |
| GameIdentity420 / GameClaims420 / GameEntitlements420 | HighCountryGamingBridge420, migration and optional gates | Existing narrow interfaces; targeted consumed claims and exact scoped entitlement checks |
| CrossGameRegistry420 | HighCountryCrossGame420 | Scoped four subject types, expiry/revocation; no wallet-wide history enumeration |
| 420Registry / manifests | Deployment discovery/configuration | Canonical names/addresses from verified maps; no new key/address invented; exact HC registration R07 |
| 420Randomness / Oracle Interface Layer | Breeding entropy adapter | Planned production adapter; existing HC coordinator accepts authorized provider entropy |
| Native $420 / 420Pay / rights infrastructure | Optional canonical settlement/licensing | Conditional integration; actual API/custody design not specified; R01.5/R01.6/R04 |
| Explorer / indexing / RPC | Canonical projections and transaction verification | Real deployment transports/cursors/finality missing; R05/R07/R09 |
| Identity/Names; Notifications/Analytics; AI/Compute/Storage; Bridge/Stake/Treasury/Governance/Verify/Arbitration | Potential additional product integrations | No mandatory direct HC binding established in this step; require explicit module specification before adding runtime dependency |

Use `contracts/config/system-addresses.json`, `contracts/config/420gamingprotocol-genesis.json`, `contracts/config/genesis-dapp-contract-map.json` and `deployments/gaming/testnet.runtime.json` as actual configuration sources. No HC-specific frozen address is assigned here. Null/unresolved runtime values are deployment blockers. Registry labels or a configured address do not attest code identity; chain ID, code/interface identity and expected roles must be verified.

Dependency direction: browser → SDK → service APIs or wallet/RPC; gameplay → narrow HC adapters → shared protocol; indexer → canonical events → derived queries. Shared Gaming contracts must not depend on HC gameplay engines. Migration has service/chain reconciliation, not a synchronous atomic DB/chain transaction. Transport/API payload details are delivered in R05 using R01.3/4 schemas; no nonexistent endpoint is advertised.

## Failure, privacy and consistency requirements

Local save failure leaves a recoverable last-known save and visible error. Registered mutations require durable idempotency keys and atomic internal accounting; retries cannot duplicate products or settlement. Service interruption blocks shared writes, while guest/local play remains available. Wallet/RPC interruption blocks canonical actions, never core play. Pending, confirmed and finalized are distinct; reorgs invalidate affected projections and prevent premature dependent issuance. Approved save migration requires durable uniqueness/outbox/reconciliation; an on-chain receipt alone is insufficient. Scoped consent and proven ownership precede linking; raw saves, credentials, email/device IDs and account identifiers remain off-chain. Workers use bounded retries and least privilege; ordinary cloud save sync does not mint canonical assets.

## Exit criteria and remaining delivery

1. Component responsibilities and actual presence are enumerated: component map.
2. Local/service/canonical authoritative state and promotion boundaries agree: state map, no canonical registry demotion.
3. Permissions and ecosystem dependencies are bounded: principal/dependency maps with unresolved trust explicitly marked.
4. Wallet-free core and social play are preserved: market/competition separation and failure boundaries.
5. Saves are distinct from canonical assets/provenance: no client promotion or raw-save chain storage.

R01.2 closes specification boundaries only. Production implementation gaps remain R02–R10. The R01.3–R01.6 records now specify types, migration, trust/deployment policy and adopted mechanics; their accumulated review is R01.7. Level 2 is R01.7; Level 3 is accumulated app-phase closeout.

R02.3 links PublicCultivationAccess reservations and allocations to PlantRegistry private/public admission and terminal release. One-time capability-authorized reciprocal binding is required before use; active allocations cannot release. See [capacity policy](R02.3-PUBLIC-PLANT-CAPACITY.md). Source consumption, harvest and production services remain later work.

R02.4 requires explicit seed/clone owner approval for the plant/parcel/plot and atomic scoped resource consumption. Source-less admission rejects; PlantRegistry now requires both resource registries in its constructor and all three reciprocal bindings before admission. Transfer invalidates approvals; termination never refunds the resource. See [source policy](R02.4-PLANT-SOURCE-CONSUMPTION.md). Clone cutting issuance and fabricated lineage/phenotype prevention remain R02.5/R02.6.
