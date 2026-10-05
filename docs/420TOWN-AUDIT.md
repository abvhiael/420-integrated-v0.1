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


## TOWN-AUDIT-4 durable closeout

Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**  
Qualified implementation/test/workflow SHA: `f5f01eae23bbc04f02ac7e9f2ab648c465a86813`  
Evidence closeout is documentation-only and follows the already-passing exact-SHA qualification.

### Implementation completed

TOWN-AUDIT-4 adds the first complete 420Town content-state layer under `town/content` while preserving the GEN-SVC boundary that high-volume post/comment bodies remain off-chain by default.

Implemented scope includes:

- stable posts bound to community, original author, content reference, SHA-256 digest, visibility, lifecycle status and revision;
- one thread per active root post, bound to the root author/community;
- comments and replies bound to thread/community with cross-thread/cross-community parent rejection;
- root-post visibility inheritance for comments so replies cannot widen a thread;
- canonical GEN-SVC visibility scopes with unknown values rejected/denied fail-closed;
- trusted relationship-context hooks for FOLLOWERS, PURCHASERS_OR_BACKERS and ORGANIZATION_MEMBERS;
- append-only post/comment revision history;
- tombstone deletion preserving stable object IDs and content digests while clearing body references;
- root-post tombstones propagating thread tombstone state;
- one canonical revisioned vote record per voter/target with set/change/clear lifecycle;
- vote eligibility requiring active community membership and target visibility;
- required idempotency keys for mutating writes;
- same-key/different-payload replay rejection;
- duplicate-content fingerprint throttling by author/community/content digest;
- per-identity write and vote limits;
- aggregate per-community write limits;
- trusted-device and trusted-network rate scopes to constrain multi-identity/Sybil swarms;
- lower limits for unknown, unverified or young identities;
- higher limits only for established verified identities;
- atomic rate-bucket charging so rejected aggregate requests do not partially consume another scope;
- machine-readable content policy/invariants in `config/420town-content-v1.json`;
- canonical Town config advancement to `CONTENT_BASELINE` and implementation through TOWN-AUDIT-4;
- Town schema catalogue alignment for content lifecycle, digests, revisions, tombstones and votes;
- Town content documentation and app overview updates;
- app-specific content verifier and exact-head CI ownership.

### Files changed for TOWN-AUDIT-4

Primary implementation/config/test/docs/workflow changes include:

- `town/content/service.go`;
- `town/content/service_test.go`;
- `config/420town-content-v1.json`;
- `config/420town-genesis.json`;
- `town/schema/v1/object-catalog.json`;
- `scripts/verify-420town-content.py`;
- `scripts/verify-420town-authority.py`;
- `docs/apps/town/content.md`;
- `docs/apps/town/index.md`;
- `town/README.md`;
- `.github/workflows/420town-audit.yml`.

### Exit criteria satisfied

1. **Posts** — implemented with stable IDs, author/community binding, off-chain references, SHA-256 digests, visibility, revisions and tombstones.
2. **Threads** — implemented as one stable thread per active root post with root-author ownership checks and tombstone propagation.
3. **Comments/replies** — implemented with thread/community integrity, parent linkage, tombstone rejection and inherited root visibility.
4. **Votes/reactions** — canonical lightweight vote records implemented for posts/comments with values `-1`/`1`, revisioned updates and clear semantics.
5. **Content hashes/references** — SHA-256 lowercase-hex digest plus bounded off-chain reference; Town stores no post/comment body bytes.
6. **Visibility rules** — all nine canonical GEN-SVC visibility scopes retained; unknown scopes fail closed; Town membership/role scopes use TOWN-AUDIT-3 authority; external relationship scopes require trusted adapter context.
7. **Deletion/tombstone semantics** — stable IDs/digests/history preserved; body references cleared; tombstoned parents/root threads reject new descendants.
8. **Idempotent/replay-safe writes** — mutating writes require idempotency keys; exact retry returns original result; same key with a changed payload is rejected.
9. **Spam/Sybil/rate-abuse controls** — duplicate digest detection, per-identity, trusted-device, trusted-network, vote and community aggregate rate windows, plus lower unknown/unverified/young identity limits are implemented and tested.
10. **Off-chain body boundary** — high-volume post/comment bodies remain off-chain by default and the verifier rejects body-payload storage primitives in the Town content service.

### Level 1 qualification evidence

GitHub Actions workflow: **420Town audit**  
Run ID: `37270292839`  
Run number: `47`  
Result: **PASS**  
Qualified SHA: `f5f01eae23bbc04f02ac7e9f2ab648c465a86813`

Passing exact-head checks:

- exact implementation SHA assertion — PASS in `town-skeleton`;
- exact implementation SHA assertion — PASS in `town-contracts`;
- canonical Town audit classification verifier — PASS;
- Town product-skeleton verifier — PASS;
- Town authoritative-state verifier — PASS;
- Town content-state verifier — PASS;
- `go test ./town/...` — PASS;
- focused Town Solidity build — PASS;
- retained Town-focused Foundry suite via `forge test --match-path "test/Town*.t.sol" -vvv` — PASS;
- cross-dApp rewards hardening via `test/RewardsCrossDappHardening420.t.sol` — PASS.

The final qualified head includes the app-specific workflow concurrency rule that cancels superseded Town audit runs while preserving all required checks on the newest exact PR head. Earlier queued/cancelled runs are not counted as passing evidence.

A small final verifier correction removed a stale requirement that `config/420town-genesis.json.status` equal the old `AUTHORITY_BASELINE` phase label. The authority verifier still validates the authority contract/config/invariants; it no longer falsely fails solely because the canonical Town phase advanced to `CONTENT_BASELINE`. This did not weaken authority semantics, and the final exact head was fully requalified after that correction.

### Security/adversarial/invariant result

The qualified TOWN-AUDIT-4 tests and verifier cover the required adversarial/boundary properties, including:

- nonmembers cannot create content or vote;
- a non-author cannot create a thread around another author’s root post;
- replies cannot cross thread/community boundaries;
- tombstoned parents/root threads reject new descendants;
- comments cannot independently widen root visibility;
- a user who cannot view the root cannot comment or vote on it;
- missing trusted relationship context fails closed for follower/backer/organization visibility;
- unknown visibility is rejected/denied;
- historical post/comment revisions remain append-only;
- tombstones preserve IDs/digests but remove body references;
- exact idempotent retries do not duplicate writes;
- idempotency-key reuse for a different payload is rejected;
- duplicate content fingerprints are rejected inside the configured window;
- unknown risk profiles receive unverified limits;
- young/unverified identities receive lower write/vote limits than established verified identities;
- aggregate community write limits constrain multi-identity floods;
- shared trusted-device and trusted-network keys constrain Sybil swarms;
- vote throttling is independently enforced;
- one voter/target maps to one canonical revisioned vote record;
- Town content state remains replaceable application state and does not acquire Identity, payment, treasury, governance, moderation, Search/Indexer, UI or rewards authority.

### Milestone status and intentionally deferred qualification

- Level 2: **not required for TOWN-AUDIT-4**. This is an ordinary app-scoped content implementation step. The major authority/lifecycle milestone was TOWN-AUDIT-3 and was already qualified at Level 2. No new shared authoritative dependency was introduced here.
- Level 3: **intentionally deferred** to **TOWN-AUDIT-10 — Documentation and exact-head repository qualification** / complete app-phase closeout.
- Repository-wide Solidity, Genesis/address authority, 420 Integrated/global, Docs/global, full client/service/Indexer/Search/RPC/frontend/backend, static/deployment/config and final current-main reconciliation are not required to close this ordinary Level 1 step unless a later dependency makes them directly applicable.
- A repository-wide Solidity workflow happened to pass on the final implementation SHA, but it is not used as the canonical completion gate for this Level 1 step because the canonical TOWN-AUDIT-4 owner is the app-specific 420Town workflow.

### Limitations and blockers

TOWN-AUDIT-4 intentionally does **not** claim completion of:

- moderation reports/hide/restore/appeal workflows;
- Identity/Storage/Search/Notifications production adapters;
- signed public API/SDK/webhook surfaces;
- durable external persistence/recovery/indexer tooling;
- user-facing frontend workflows;
- live testnet or production deployment/operations.

Those belong to later canonical Town roadmap steps. There are **no blockers to TOWN-AUDIT-4 completion**.

Current `main` at closeout: `b338b9c9c140957b0ea8619b0b20bfed415f2c6d`.  
PR #523 historical base SHA: `b301bd27bee7f412589c36b7a8cdbcad6f69a7e8`.  
PR #523 remains open and mergeable. Final reconciliation to then-current `main` remains a Level 3 responsibility unless a later Town step materially requires earlier reconciliation.

### Completion state

**TOWN-AUDIT-4 — COMPLETE.**

Next canonical roadmap step: **TOWN-AUDIT-5 — Moderation and appeals**.


## TOWN-AUDIT-5 durable closeout

Status: **COMPLETE**  
Qualification level: **Level 1 + Level 2 moderation/content integration milestone**  
Qualified implementation/test/workflow SHA: `04fb48b8aca4bf65cf606a139d10b7b8a2129288`  
Evidence closeout is documentation-only and follows the already-passing exact-SHA qualification.

### Implementation completed

TOWN-AUDIT-5 adds the complete shared GEN-SVC moderation/appeal lifecycle to 420Town and integrates moderation as a mandatory gate across the accumulated TOWN-AUDIT-4 content paths.

Implemented scope includes:

- canonical moderation actions `REPORT`, `HIDE`, `BLOCK`, `MUTE`, `SUSPEND`, `APPEAL`, `MODERATOR_DECISION`, `RESTORE`, `LOCK`;
- replaceable off-chain moderation cases and append-only moderation records;
- post, comment and user moderation targets;
- active-community-membership requirement for reports;
- active MODERATOR/ADMIN requirement for privileged moderation actions;
- strict community/domain scoping of moderator/admin capability;
- user-scoped BLOCK/MUTE relationship state;
- community/Town-scoped user SUSPEND state;
- affected-subject-only appeal authorization;
- MODERATOR_DECISION transition restricted to an APPEALED case;
- append-only parent-record provenance, previous/result state, actor, affected subject and monotonic case version;
- bounded optional moderation evidence reference plus lowercase SHA-256 digest validation;
- idempotent moderation writes with exact retry and changed-payload replay rejection;
- RESTORE semantics that clear HIDE/LOCK/SUSPEND enforcement without rewriting prior records;
- active target-case release on restoration so a later independent report can open a new case;
- mandatory moderation gate passed into the Town content service at construction;
- fail-closed moderation dependency behavior until a content resolver is attached;
- moderation enforcement on post creation, edits, deletion, thread creation, comments/replies, comment edits/deletion, voting, vote clearing, content reads and revision-history reads;
- alternate-path bypass prevention for hidden, locked and suspended content/users;
- hidden-content review access retained for the affected author and in-domain moderator/admin;
- LOCK preserving read access while blocking interactions;
- model/schema/config/docs/verifier/CI alignment for the moderation baseline;
- canonical Town phase advancement to `MODERATION_BASELINE` and implementation through TOWN-AUDIT-5.

### Files changed for TOWN-AUDIT-5

Primary implementation/config/test/docs/workflow changes include:

- `town/moderation/service.go`;
- `town/moderation/service_test.go`;
- `town/content/service.go`;
- `town/content/service_test.go`;
- `town/model/model.go`;
- `town/model/model_test.go`;
- `config/420town-moderation-v1.json`;
- `config/420town-genesis.json`;
- `town/schema/v1/object-catalog.json`;
- `scripts/verify-420town-moderation.py`;
- `scripts/verify-420town-content.py`;
- `docs/apps/town/moderation.md`;
- `docs/apps/town/index.md`;
- `town/README.md`;
- `.github/workflows/420town-audit.yml`.

### Canonical exit criteria satisfied

1. **Shared GEN-SVC vocabulary** — all nine canonical moderation actions are retained exactly in config, model, service and verifier surfaces.
2. **Domain-scoped moderator authority** — privileged moderation requires active MODERATOR or ADMIN status in the target community; the same role in another community confers no capability.
3. **Escalation boundaries** — ordinary members cannot HIDE/LOCK/SUSPEND/RESTORE/decide cases; moderation cannot transfer assets, mutate payments/treasury, revoke protocol identity, alter ownership/rights or execute wallet/protocol actions.
4. **Appeals** — only the affected subject can appeal an eligible adverse case state; unrelated reporter/users cannot appeal on their behalf.
5. **Provenance** — report, moderation action, appeal, decision and restoration are append-only records with parent linkage, previous/result state, actor/affected subject, version and timestamp/evidence provenance.
6. **Alternate-path bypass** — HIDE/LOCK/SUSPEND enforcement is consulted by all accumulated content read/write/history/vote/thread/reply routes rather than by one UI path only.
7. **Restoration semantics** — RESTORE clears active HIDE/LOCK/SUSPEND enforcement, preserves prior decision history, re-enables allowed content paths and permits a later independent case without rewriting the restored case.

### Exact-head qualification evidence

GitHub Actions workflow: **420Town audit**  
Run ID: `37274475535`  
Run number: `69`  
Result: **PASS**  
Qualified implementation SHA: `04fb48b8aca4bf65cf606a139d10b7b8a2129288`

Jobs:

- `town-skeleton` / job `111648430690` — **PASS**;
- `town-contracts` / job `111648430382` — **PASS**.

Passing exact-head checks:

- exact implementation SHA assertion in both jobs — PASS;
- canonical Town audit classification verifier — PASS;
- Town product-skeleton verifier — PASS;
- Town authoritative-state verifier — PASS;
- Town content-state verifier — PASS;
- Town moderation-state verifier — PASS;
- `go test ./town/...` — PASS;
- focused Town Solidity build — PASS;
- retained Town-focused Foundry inventory via `forge test --match-path "test/Town*.t.sol" -vvv` — PASS;
- cross-dApp rewards hardening via `test/RewardsCrossDappHardening420.t.sol` — PASS.

### Diagnosed pre-qualification failures

Two earlier exact-head attempts were rejected rather than treated as evidence:

1. At implementation SHA `1bae503eccaedcc060317b9087e69fdee614b920`, the retained content verifier failed because it still required the old phase label `CONTENT_BASELINE`. The canonical Town config had correctly advanced to `MODERATION_BASELINE`. The verifier was corrected to validate TOWN-AUDIT-4 implementation/deferred state rather than freeze an obsolete phase label. No content invariant was weakened.
2. At SHA `a2266b1876966a4840598c8dd3bba5e98289699f`, all Town verifiers passed but `go test ./town/...` found a compile-time adapter mismatch: an internal moderation helper still passed `TargetKind` directly after the content-resolver interface had intentionally been decoupled to `string`. The adapter was fixed with an explicit conversion. No moderation semantics or assertions were weakened.

The resulting exact SHA `04fb48b8aca4bf65cf606a139d10b7b8a2129288` was then qualified from scratch by the full app-specific workflow and is the only authoritative implementation evidence for this closeout.

### Security/adversarial/invariant result

The qualified moderation/content integration suite directly proves:

- cross-community moderator privilege cannot be used against another community;
- ordinary community members cannot invoke privileged moderator transitions;
- HIDE blocks ordinary reads, history reads, votes, edits and thread creation through alternate paths;
- the hidden-content author and in-domain moderator/admin retain review access;
- LOCK preserves ordinary read access but blocks voting/thread interaction;
- RESTORE re-enables the previously allowed paths;
- only the affected identity can appeal;
- report → HIDE → APPEAL → MODERATOR_DECISION → RESTORE preserves an ordered append-only provenance chain and monotonically increasing versions;
- SUSPEND blocks writes only in the affected community and does not leak into a different Town community;
- suspended users can appeal and be restored through the same provenance-preserving lifecycle;
- BLOCK and MUTE are user-scoped and do not affect unrelated viewers;
- UNBLOCK/UNMUTE restore the relationship-scoped access behavior;
- exact moderation retries are idempotent and changed-payload key reuse fails closed;
- restored targets may later receive a new independent report without rewriting the historical restored case;
- malformed moderation evidence digests fail closed;
- content reporting requires valid target/community provenance;
- missing moderation/content dependency context fails closed rather than allowing bypass;
- moderation state remains replaceable application state and acquires no wallet, asset, payment, treasury, rights, protocol identity or other protocol authority.

### Milestone status

TOWN-AUDIT-5 is treated as a **Level 2 app integration milestone** in addition to its Level 1 step qualification because it introduces a new moderation lifecycle and makes that lifecycle a mandatory cross-component dependency of all accumulated Town content paths.

The Level 2 evidence remains app-focused as required: the same exact implementation SHA revalidated the complete Town Go package suite, all Town-specific verifiers, the retained Town Foundry suite and cross-dApp rewards hardening. No ceremonial repository-wide closeout was required.

### Intentionally deferred Level 3 scope

Level 3 remains intentionally deferred to **TOWN-AUDIT-10 — Documentation and exact-head repository qualification** / complete app-phase closeout.

The following are not required to close TOWN-AUDIT-5 and remain deferred unless a later Town dependency makes them directly applicable sooner:

- final reconciliation to then-current `main`;
- canonical repository-wide full Solidity inventory ownership/reconciliation;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- full client/service/Indexer/Search/RPC/frontend/backend qualification;
- final static/security/deployment/config production qualification.

A broad repository workflow may run incidentally because of repository trigger policy, but it is not substituted for the canonical Town Level 1/2 evidence and skipped/unrelated global checks are not counted as passing Town evidence.

### Limitations and blockers

TOWN-AUDIT-5 intentionally does **not** claim completion of:

- production Identity/Storage/Search/Notifications/encrypted-transport adapters;
- signed public API/SDK/webhook/indexer/recovery surfaces;
- user-facing web application workflows;
- final security-hardening phase;
- live testnet qualification;
- production/genesis-facing service release.

Those remain later canonical Town roadmap steps. There are **no blockers to TOWN-AUDIT-5 completion**.

Current `main` at closeout: `b338b9c9c140957b0ea8619b0b20bfed415f2c6d`.  
PR #523 historical base SHA: `b301bd27bee7f412589c36b7a8cdbcad6f69a7e8`.  
PR #523 remains open and mergeable. Final current-main reconciliation remains a Level 3 responsibility unless a later Town step materially requires it earlier.

### Completion state

**TOWN-AUDIT-5 — COMPLETE.**

Next canonical roadmap step: **TOWN-AUDIT-6 — Service integrations**.
