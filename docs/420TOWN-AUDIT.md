# 420Town repository audit

Status: ACTIVE / NOT COMPLETE  
Audit branch: `audit/420town-complete-20261004`  
Baseline main: `b301bd27bee7f412589c36b7a8cdbcad6f69a7e8`

## Canonical definition

420Town is **not** a frozen Genesis application in `config/genesis-applications.json`. The current frozen Genesis application decision does not list 420Town.

420Town **is** present in `config/genesis-consumer-services.json` as the replaceable Genesis-facing consumer-service target:

- service ID: `420/service/town/v1`
- name: `420Town Community Boards`
- role: `GENESIS_FACING_UPDATE`
- target: `communities_posts_threads_comments_votes_moderation`
- direct declared dependencies: `420 Identity`, `420 Search`, `420 Notifications`, `420 Storage`

The consumer-service registry explicitly states that this does not amend the frozen Genesis application catalog.

System architecture further defines a Town-style hybrid trust model:

- membership, roles, permissions, subscriptions, treasuries and entitlements are authoritative/on-chain where they carry authority;
- high-volume/private/rebuildable bodies and message transport/storage remain off-chain;
- transport failure must not rewrite canonical membership or entitlement state.

## Repository implementation discovered

### Present

Town-specific Solidity currently consists only of the optional 420Rewards contribution integration:

- `contracts/src/town/ITownContributionSource420.sol`
- `contracts/src/town/ITownContributionVerifier420.sol`
- `contracts/src/town/TownContributionVerifier420.sol`
- `contracts/src/town/TownRewardTypes420.sol`
- `contracts/src/town/TownRewardsAdapter420.sol`

Focused tests:

- `contracts/test/MockTownContributionSource420.sol`
- `contracts/test/TownRewardsIntegration420.t.sol`
- `contracts/test/TownContributionVerifierContent420.t.sol`
- `contracts/test/TownContributionVerifierGovernance420.t.sol`
- shared cross-dApp rewards hardening in `contracts/test/RewardsCrossDappHardening420.t.sol`

PR #45 records the design boundary: rewards are optional and Town social/community state remains independently authoritative.

### Missing product implementation

No repository implementation was found for the canonical Town product target itself:

- community lifecycle/service
- membership lifecycle and role assignment
- community-scoped permission enforcement
- posts/threads/comments/votes authoritative application model
- moderation state machine and appeal workflow
- subscription/entitlement state
- community treasury state
- off-chain encrypted messaging/transport adapter for Town
- content storage adapter
- Search projection/adapter
- Notifications integration
- Identity integration beyond architectural dependency declaration
- Town API
- Town SDK/client
- Town indexer/projection
- Town frontend/web UI
- deployment/runtime configuration
- environment template
- production/testnet deployment records
- app-specific operator runbook
- app-specific threat model
- app-specific user/developer documentation
- release/qualification evidence for the product

The rewards adapter does **not** satisfy these missing Town application responsibilities.

## Canonical-source reconciliation

A Wallet catalogue document records `420/service/town/v1` as not a canonical frozen Genesis app-service ID for Wallet catalogue purposes. This does not conflict with the GEN-SVC registry once the source roles are separated:

1. `config/genesis-applications.json` is the frozen Genesis application decision.
2. `config/genesis-consumer-services.json` is a composition/implementation registry and explicitly does not promote its entries into the frozen catalog.
3. Therefore `420/service/town/v1` is a valid GEN-SVC implementation identifier, but must not be represented as a frozen Genesis application ID unless an explicit catalog decision later promotes it.

## Security review of existing Town code

### Verified / mitigated

- reward publication defaults to deny through `ContributionRegistry420` authorization;
- the adapter cannot publish unsupported contribution classes;
- verifier binds contribution type, source ID, beneficiary and evidence;
- reward evidence includes `block.chainid` domain separation;
- same source/type reward replay is rejected by the shared Contribution Registry;
- moderation rewards require a finalized, non-overturned action that was authorized at action time;
- translation rewards require distinct non-zero language IDs and accepted translation state;
- invalid zero source/beneficiary/evidence inputs fail closed;
- the rewards path is optional and does not become Town's application authority.

### Unresolved because product is absent

The repository cannot yet qualify Town-specific controls for membership privilege escalation, moderator/admin separation, voting abuse, Sybil/spam handling, visibility leakage, deletion/tombstone semantics, appeal transitions, treasury custody/accounting, subscription entitlement replay, API authorization, webhook replay, index poisoning, off-chain message confidentiality, reorg recovery, or frontend transaction safety because those components do not exist.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Town classification | frozen app decision + GEN-SVC registry | correctly separated by source role | audit verifier | this audit | COMPLETE | keep distinction explicit |
| Communities | GEN-SVC target | absent | none | architecture only | MISSING | implement community service/model |
| Posts/threads/comments | GEN-SVC target | reward-source interface only; no Town state/service | reward verifier tests only | architecture only | MISSING | implement application state/API/storage/projection |
| Votes | GEN-SVC target | absent | none | registry mention only | MISSING | implement vote model and abuse controls |
| Moderation | GEN-SVC target + shared moderation model | reward evidence verifier only | reward verifier tests | shared GEN-SVC docs | PARTIAL | implement moderation lifecycle, roles, appeals, audit events |
| Membership | genesis architecture | absent | none | architecture only | MISSING | implement authoritative membership state |
| Roles/permissions | genesis architecture + GEN-SVC permissions | absent | none | shared permission model | MISSING | implement scoped role/capability model |
| Subscriptions/entitlements | genesis architecture | absent | none | architecture only | MISSING | define and implement lifecycle/replay rules |
| Community treasuries | genesis architecture | absent | none | architecture only | MISSING | define custody/accounting and authority |
| Identity integration | GEN-SVC dependency | declaration only | none | dependency docs | PARTIAL | implement and test identity binding |
| Search integration | GEN-SVC dependency | declaration only | none | dependency docs | MISSING | implement visibility-safe search projection |
| Notifications integration | GEN-SVC dependency | declaration only | none | dependency docs | MISSING | implement provenance-safe opt-in events |
| Storage integration | GEN-SVC dependency | declaration only | none | dependency docs | MISSING | implement content-addressed/off-chain storage path |
| Messaging transport | architecture + GEN-SVC roadmap | absent | none | architecture only | MISSING | implement replaceable encrypted transport adapter |
| Rewards integration | PR #45 + contracts | implemented optional adapter/verifier | focused + cross-dApp tests | PR history/code | COMPLETE | retain as optional integration |
| API | GEN-SVC API conventions | absent | none | shared conventions only | MISSING | implement /v1 API with auth/idempotency/pagination |
| SDK/client | GEN-SVC SDK contract | absent | none | shared conventions only | MISSING | implement typed client |
| Frontend | Genesis-facing product target | absent | none | none | MISSING | implement primary community workflows |
| Deployment config | release requirements | absent | none | none | MISSING | add runtime/env/deployment manifests |
| App docs | audit requirements | no Town app docs before audit | verifier + audit docs | audit docs added | PARTIAL | create developer/user/operator docs alongside implementation |
| Testnet evidence | release qualification | absent | none | none | BLOCKED | requires implementation first, then live testnet qualification |
| Production evidence | release qualification | absent | none | none | BLOCKED | requires testnet + deployment/ops evidence |

## Readiness

- CODE COMPLETE: **NO** — canonical Town product implementation is missing.
- BUILD COMPLETE: **NO** — no complete Town product exists to build.
- CONTRACT COMPLETE: **NO** — rewards contracts are complete for their optional scope, but canonical Town authority contracts/state are absent.
- TEST COMPLETE: **NO** — tests cover rewards integration, not the Town product.
- DOCUMENTATION COMPLETE: **NO** — app-specific developer/user/operator documentation remains incomplete.
- INTEGRATION COMPLETE: **NO** — declared Identity/Search/Notifications/Storage integrations are not implemented.
- SECURITY QUALIFIED: **NO** — application-specific attack surface cannot be qualified before implementation.
- TESTNET READY: **NO** — missing product/runtime/deployment implementation.
- GENESIS READY: **NO** — 420Town is not a frozen Genesis application and its Genesis-facing service target is not implemented.
- PRODUCTION READY: **NO** — implementation, integration, deployment and operational evidence are missing.

## Determination

420Town is **not complete**. The repository currently contains a useful and security-conscious optional rewards integration plus shared architecture/service-registry definitions, but not the canonical community application described by those definitions.

The remediation sequence is tracked in `docs/420TOWN-ROADMAP.md`.
