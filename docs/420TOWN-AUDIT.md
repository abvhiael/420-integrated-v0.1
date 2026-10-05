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


## TOWN-AUDIT-2 durable closeout

Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**  
Qualified implementation/CI SHA: `df311795f073cde6b58c9d113ab27b12eeb7f154`  
Evidence closeout follows the already-passing exact-SHA implementation qualification and changes documentation only.

### Implementation completed

TOWN-AUDIT-2 established the repository-owned Town product skeleton without pulling TOWN-AUDIT-3 lifecycle semantics forward:

- canonical application root under `town/`;
- package/build ownership under the repository root Go module;
- `town/README.md` and `docs/apps/town/index.md`;
- secret-free `town/.env.example`;
- canonical `config/420town-genesis.json`;
- versioned `town/schema/v1/object-catalog.json`;
- Go-owned Town model/config packages and direct tests;
- opaque stable object-ID policy and shared visibility vocabulary;
- Town skeleton drift verifier;
- app-specific CI ownership with exact-SHA assertions;
- retained focused Solidity/rewards qualification for the pre-existing optional Town rewards path.

Implementation files changed between the pre-step head `e94e21a7dd1be9ca345b6cf0949a6f34b46518ae` and qualified implementation SHA:

- `.github/workflows/420town-audit.yml`;
- `config/420town-genesis.json`;
- `docs/apps/town/index.md`;
- `scripts/verify-420town-skeleton.py`;
- `town/.env.example`;
- `town/README.md`;
- `town/config/config.go`;
- `town/config/config_test.go`;
- `town/model/model.go`;
- `town/model/model_test.go`;
- `town/schema/v1/object-catalog.json`.

### Exit criteria satisfied

1. Canonical Town application directories exist and have explicit ownership.
2. Package/build ownership is defined under `github.com/420integrated/420-integrated`.
3. App README, environment template and canonical configuration exist.
4. Stable versioned Town object vocabulary and opaque stable ID policy exist.
5. CI ownership/gates exist and assert the exact implementation SHA.

No TOWN-AUDIT-3 authoritative community lifecycle, authorization, treasury or entitlement behavior is claimed by this closeout.

### Level 1 qualification evidence

GitHub Actions workflow: **420Town audit**  
Run ID: `37261221863`  
Result: **PASS**  
Qualified SHA: `df311795f073cde6b58c9d113ab27b12eeb7f154`

Passing retained checks include:

- exact implementation SHA assertion;
- canonical Town audit verifier;
- Town product skeleton verifier;
- `go test ./town/...`;
- focused Town Solidity build;
- focused Town Foundry tests using `test/Town*.t.sol`;
- cross-dApp rewards hardening using `test/RewardsCrossDappHardening420.t.sol`.

The immediately prior exact SHA `d25d8c168758b38758bb1064b260d5211d8c7f91` also passed 420Town audit run `37260761902`. The later SHA `df311795f073cde6b58c9d113ab27b12eeb7f154` changed CI command consolidation and was therefore separately requalified; its passing run is authoritative for this closeout.

### Security/adversarial/invariant result

For the scope of TOWN-AUDIT-2, configuration drift and authority-classification substitution fail closed through the skeleton verifier/config tests, opaque IDs are not parsed into application authority, and the retained optional rewards path passed its focused and cross-dApp hardening suites. Broader Town authority/security properties belong to later canonical steps and are not claimed complete here.

### Milestone and deferred qualification

- Level 2: **not required**; TOWN-AUDIT-2 is a repository/product skeleton step and not an app integration milestone.
- Level 3: **intentionally deferred** to TOWN-AUDIT-10 / complete app-phase closeout. Full repository Solidity inventory, Genesis/address authority, 420 Integrated/global, Docs/global, broad clients/services and final deployment/config reconciliation are not required to close this ordinary Level 1 step.
- Current main at closeout: `b3cfd359db5ac84aff6213119475ea3dc770642d`.
- PR #523 base SHA remains `b301bd27bee7f412589c36b7a8cdbcad6f69a7e8`; reconciliation with then-current `main` is deferred to the required Level 3 closeout unless a later Town step materially requires earlier reconciliation.
- Live testnet is not a blocker for TOWN-AUDIT-2.

### Completion state

**TOWN-AUDIT-2 — COMPLETE.**

Next canonical roadmap step: **TOWN-AUDIT-3 — Authoritative community state**.


## TOWN-AUDIT-3 durable closeout

Status: **COMPLETE**  
Qualification level: **Level 1 + Level 2 authority milestone qualification**  
Qualified implementation/test SHA: `5f8f4a3ad21ad2a1180b2c6af81a2794cffeffb2`  
Evidence closeout is documentation-only and follows the already-passing exact-SHA qualification.

### Implementation completed

TOWN-AUDIT-3 establishes the authoritative on-chain community state surface for 420Town through `TownAuthority420` and aligns the canonical config/schema/docs/test surfaces to that authority model.

Implemented scope includes:

- community creation, metadata commitment and ownership transfer;
- owner-as-active-member invariant;
- membership states `NONE`, `ACTIVE`, `LEFT`, `REMOVED`;
- controlled rejoin/reinstatement semantics;
- fixed community-scoped MEMBER/MODERATOR/ADMIN roles;
- default-deny Town permissions with owner-controlled role-permission configuration;
- owner-only ADMIN assignment/revocation to prevent privilege self-escalation;
- privileged-role clearing on leave/removal to prevent stale-role resurrection;
- explicit revisioned subscription lifecycle;
- explicit revisioned entitlement lifecycle;
- immediate effective expiry plus explicit expiry materialization;
- reference-only treasury authority binding with paired authority ID/address validation;
- no Town deposit/withdrawal/transfer/custody path and no parallel Town balance ledger;
- authority mutation events with community/actor/revision provenance;
- machine-readable invariant inventory in `config/420town-authority-v1.json`;
- canonical config advancement to `AUTHORITY_BASELINE`;
- aligned Go model and schema vocabulary;
- app documentation for the authority/trust boundary;
- CI ownership for authoritative-state verification and retained Town integration regressions.

### Explicit authority boundary

Town authority is not delegated to Search, 420Indexer, message transport, frontend, Storage gateways, Notifications or rewards. Those systems may project, transport or react to Town state but cannot widen, replace or override the authoritative community state represented by `TownAuthority420`.

Treasury handling is intentionally reference-only. Town binds the external authority identifier and treasury address but does not claim settlement, custody or accounting ownership beyond that binding.

### Exit criteria satisfied

1. Communities are implemented as authoritative application state.
2. Membership lifecycle is explicit and tested, including owner safety and removal/reinstatement behavior.
3. Roles are community-scoped and tested against cross-community leakage.
4. Permissions are default deny and tested against self-escalation.
5. Subscriptions and entitlements have explicit revisioned lifecycle behavior and expiry semantics.
6. Treasury authority binding is implemented without creating a competing custody/balance ledger.
7. Authority events exist and event provenance is directly tested.
8. Explicit invariants are machine-readable and verifier-enforced.
9. Search, Indexer, transport, UI and rewards remain non-authoritative.

### Qualification evidence

GitHub Actions workflow: **420Town audit**  
Run ID: `37267431040`  
Run number: `28`  
Result: **PASS**  
Qualified SHA: `5f8f4a3ad21ad2a1180b2c6af81a2794cffeffb2`

Passing exact-head checks:

- exact implementation SHA assertion in both Town jobs;
- canonical Town audit classification verifier;
- Town product-skeleton verifier;
- Town authoritative-state verifier;
- `go test ./town/...`;
- Town Solidity build including `TownAuthority420`;
- retained full Town-focused Foundry inventory via `forge test --match-path "test/Town*.t.sol" -vvv`;
- cross-dApp rewards hardening via `test/RewardsCrossDappHardening420.t.sol`.

The immediately prior exact-head run on `8cabe21cdce020b08515c83b49969c7ae375fec3` failed six focused tests. Investigation showed all six failures were test-harness defects: one-shot `vm.prank(OWNER)` calls were consumed by intervening public constant getter calls before the protected action. The tests were corrected to resolve constants before applying the prank. No Town authorization semantics were weakened. The corrected exact-head run above passed fully and is the authoritative evidence for this closeout.

### Security/adversarial/invariant result

The qualified suite directly exercises and passes the core TOWN-AUDIT-3 adversarial properties:

- unknown permission fails closed;
- non-owner/non-authorized actors cannot manage members, roles, subscriptions, entitlements or treasury references;
- ADMIN cannot self-grant additional role permissions;
- ADMIN cannot grant ADMIN to another member;
- role/permission state is community-scoped and cannot cross community boundaries;
- leaving/removal clears privileged roles and later rejoin does not resurrect them;
- removed members cannot self-rejoin;
- owners cannot leave or be removed while owner;
- ownership transfer requires an active member successor;
- active subscription/entitlement replay is rejected by lifecycle state;
- nonmembers cannot receive active subscriptions or entitlements;
- expiry is effective at the deadline and can be durably materialized;
- treasury authority/address must be paired;
- Town rejects plain value transfer and exposes no custody primitive;
- authority mutation events bind scope/actor/revision as applicable;
- optional Town rewards behavior remains independently hardened and default-deny.

### Milestone qualification and deferred scope

TOWN-AUDIT-3 is treated as a **Level 2 milestone** because it introduces the core authoritative community lifecycle and authorization surface. Level 2 was satisfied by the retained Town-wide focused Foundry inventory plus cross-dApp rewards hardening on the same exact implementation SHA, in addition to the step-specific authority verifier and Go checks.

Level 3 remains intentionally deferred to **TOWN-AUDIT-10 — Documentation and exact-head repository qualification**. Full repository Solidity inventory ownership, Genesis/address authority, repository/global suites, complete deployment/config reconciliation and final reconciliation to then-current `main` are not claimed by this step.

Current `main` at evidence closeout: `b338b9c9c140957b0ea8619b0b20bfed415f2c6d`.

PR #523 remains open. Its historical base is `b301bd27bee7f412589c36b7a8cdbcad6f69a7e8`, and it currently reports diverged/non-mergeable against current `main`. That repository-integration debt is explicitly retained for the required Level 3 closeout unless a later Town step materially requires earlier reconciliation.

Live testnet is not a blocker for TOWN-AUDIT-3.

### Completion state

**TOWN-AUDIT-3 — COMPLETE.**

Next canonical roadmap step: **TOWN-AUDIT-4 — Content, threads, comments and votes**.
