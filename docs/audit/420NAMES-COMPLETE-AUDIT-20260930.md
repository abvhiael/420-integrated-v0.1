# 420Names complete repository audit — 2026-09-30

## Scope and authority

This audit evaluates **420Names / `Names420`** against repository evidence, not conversational plans. The authoritative baseline is `main` at `bd00e64e29e74c96b4d89b1254254547767a6851`. Remediation is isolated on `audit/420names-complete-20260930`.

The application is defined as a Genesis, user-facing protocol application whose canonical authority is limited to `.420` ownership, lease expiry, forward/reverse resolution, and optional references to 420Identity profiles and 420Registry services. A name is not identity proof, reputation, protocol legitimacy, wallet authority, or custody authority.

## Canonical sources reviewed

- `contracts/src/apps/Names420.sol`
- `contracts/src/interfaces/genesis/INames420.sol`
- `contracts/config/genesis-dapp-contract-map.json`
- `contracts/config/genesis-canonical-addresses.json`
- `contracts/config/genesis-address-namespace.json`
- `contracts/config/system-addresses.json`
- `contracts/config/deployment-manifest.json`
- `contracts/config/predeploy/predeploy-plan.json`
- `contracts/config/predeploy/storage-init.json`
- `contracts/config/interfaces/genesis-interface-layer.json`
- `contracts/config/interfaces/interface-layer-v1-freeze.json`
- `contracts/config/interfaces/dependency-matrix.json`
- `wallet/deployment-inventory.json`
- `wallet/web/core/names-client.js`
- `wallet/web/core/names-send.js`
- `wallet/web/core/names-guided-send.js`
- `420-indexer/src/abi-manifest.ts`
- `420-indexer/src/lifecycle-reducer.ts`
- `420-indexer/sql/004-genesis-materialized-views.sql`
- `420-indexer/sql/005-genesis-state-views.sql`
- `search/discovery/names_identity.go`
- `docs/architecture/protocols/registry-names-identity-420is.md`
- `docs/architecture/genesis-architecture.md`
- `docs/architecture/dependency-map.md`
- `docs/apps/names/**`
- `docs/audit/genesis-documentation-matrix.json`
- retained tests and CI workflows touching Names420

## Canonical architecture

### Contract authority

`Names420` is the canonical state authority for:

- label-hash ownership;
- pending transfer owner;
- forward resolved address;
- optional Identity profile reference;
- optional Registry service reference;
- lease expiry;
- reverse name selection, valid only while forward resolution agrees.

### Registration and lifecycle

The implementation and architecture documentation agree on:

- commitment domain: `420/NAMES/COMMITMENT/V1`;
- minimum commitment age: 60 seconds;
- maximum commitment age: 24 hours;
- registration duration per operation: 30–365 days;
- maximum label length input: 63;
- commitments bound to the revealer/committer;
- expired records are non-authoritative;
- transfer is nominate/accept;
- accepted transfer resets resolution to the new owner and clears profile/service references;
- reverse resolution is revalidated against current forward resolution and expiry.

### Trust boundaries

- 420Names does not prove legal identity.
- 420Names does not grant wallet/custody authority.
- 420Names does not establish a Registry service as canonical merely because a name points at a service ID.
- Names↔Identity is strong only when both protocols independently agree.
- Indexer/Search/Wallet are derived consumers, not canonical Names authority.

## Repository state at audit start

| Field | Value |
|---|---|
| Repository | `abvhiael/420-integrated-v0.1` |
| Baseline branch | `main` |
| Baseline SHA | `bd00e64e29e74c96b4d89b1254254547767a6851` |
| Audit branch | `audit/420names-complete-20260930` |
| Existing Names-specific PR at start | none found |
| Historical Names branch | `feature/420-registry-identity-names-v1` @ `1e7d7f48b8b614aae51e3ba816ae24b0671d7235` |
| Compiler | Solidity 0.8.24 |
| EVM target | Cancun |
| Contract build system | Foundry |
| Wallet runtime | Node >=22 |

The similarly named `abvhiael/420-integrated` repository was inspected first but its current `main` is a Mad Buds-only project snapshot and does not contain the active Genesis protocol implementation. It is not the authoritative repository for this audit.

## File and component inventory

| Component | Current state | Status |
|---|---|---|
| `contracts/src/apps/Names420.sol` | full source implementation present | COMPLETE |
| `contracts/src/interfaces/genesis/INames420.sol` | existed but ABI contradicted implementation; reconciled on audit branch | COMPLETE |
| Canonical architecture docs | present and coherent with core lifecycle | COMPLETE |
| User guide/getting started/security/troubleshooting | present | COMPLETE |
| Genesis dApp map entry | `420 Names -> Names420.sol` | COMPLETE |
| Frozen system address | `0x0000000000000000000000000000000000000435` | COMPLETE |
| Historical `0x0445` proposal | explicitly retired/not deployable | COMPLETE |
| Predeploy plan | source listed at 0x0435 | PARTIAL |
| Runtime artifact | planned as `contracts/artifacts/Names420.json`, not frozen in deployment manifest | MISSING |
| Runtime code hash | no Names420 hash in deployment manifest | MISSING |
| Constructor-derived predeploy state | constructor intent described; no Names-specific frozen generated state artifact | PARTIAL |
| Live/testnet deployment proof | explicitly not chain verified | MISSING |
| Wallet read client | chain/code/identity/version/ABI checks present | COMPLETE |
| Wallet guided-send integration | guarded resolution path present | COMPLETE |
| Name registration/renewal/transfer write client | no non-test implementation found | MISSING |
| Standalone 420Names frontend/routes | no application implementation found | MISSING |
| 420Indexer descriptor mapping | Names420 -> 420Names present | COMPLETE |
| Indexer Names event/state SQL views | present | COMPLETE |
| Search discovery reducer | present | COMPLETE |
| Names-specific CI | absent on baseline; added by audit | COMPLETE |
| Names-specific audit evidence | this audit + CI workflow added | PARTIAL until CI closes |

## Smart-contract audit

### Verified implementation behavior

The contract contains no token custody or arbitrary external-call path. Registration is commit/reveal and the commitment includes the committer, preventing a different address from revealing a copied commitment. Commitments are one-use because registration deletes the commitment. Name overwrite is blocked while a lease is active.

Owner-only mutations are enforced for renewal, forward resolution, and transfer nomination. Transfer acceptance is restricted to the nominated pending owner. Transfer acceptance clears old profile/service references and resets forward resolution to the new owner.

Reverse resolution cannot remain authoritative after forward resolution changes or the lease expires because `reverseResolve` rechecks both conditions.

### Interface defect found and repaired

Baseline `INames420.resolve(bytes32)` declared a single `address` return while `Names420.resolve(bytes32)` returns the complete seven-field `Record`.

Because Solidity function selectors do not encode return types, a caller compiled against the stale interface would successfully call `resolve(bytes32)` and decode the first returned word — `owner` — as the resolved address. That can misdirect an integration even though the implementation itself is correct.

Audit remediation:

- reconciled `INames420.Record` with the implementation;
- changed `INames420.resolve` to return the complete record;
- exposed `nameClaimsProfile` on the shared read interface;
- added a regression proving that `owner` and `resolvedAddress` remain distinct through the interface;
- documented the canonical tuple and explicit `resolvedAddress` requirement.

This is a pre-Genesis correction of an internally contradictory frozen interface. It must be reviewed as interface-layer reconciliation because the v1 freeze policy otherwise treats semantic interface changes as versioned changes.

### Canonical dependency model — reconciled in NAMES-AUDIT-2

NAMES-AUDIT-2 resolved the stale generic dependency row without expanding Names420 authority.

The canonical direct runtime dependency set for 420Names is now:

1. GovernanceAuthority

`Names420` binds that dependency through the nonzero immutable governance timelock in `SystemAccess`. The current Names contract exposes no governance-only name mutation, so this is a system authority identity boundary rather than ambient control over user names.

The remaining legacy entries were classified in `contracts/config/interfaces/names-dependency-model.json` and the architecture decision `docs/architecture/decisions/NAMES-AUDIT-2-DEPENDENCY-MODEL.md`:

- ProtocolRegistry — OPTIONAL_INTEGRATION;
- GenesisInitialization — REQUIRED_INDIRECT deployment/predeploy concern;
- ReplayProtection — LOCAL_MECHANISM implemented by commit/reveal consumption;
- ChainContext — CONSUMER_LAYER;
- PauseRegistry, CapabilityRegistry, SystemSafety, Migration, SignedEnvelope and MetadataCommitment — not current Names420 runtime dependencies.

The shared Genesis interface inventory remains frozen and available to applications that require those interfaces. This reconciliation changes only the app-specific normative dependency set and prevents unused shared interfaces from becoming unintended authority over 420Names.

## Application-layer audit

### Wallet integration

The Wallet implementation is materially stronger than a simple address lookup:

- lowercase ASCII `.420` normalization;
- rejection of Unicode/lookalike and malformed labels;
- chain-ID verification before and after RPC calls;
- deployed-code check;
- contract identity check via `systemName() == "Names420"`;
- protocol version check (`3`);
- exact seven-word record decoding;
- label-length integrity check;
- trusted chain timestamp retrieval;
- guarded guided-send confirmation before value transfer.

This is a valid **consumer integration**, not a complete 420Names application.

### Missing user-facing management application

Repository documentation explicitly classifies 420 Names as a user-facing Genesis protocol application and describes registration, renewal, resolution updates, reverse-name setting, transfer nomination, and transfer acceptance as user workflows.

Repository search found no production write client calling `makeCommitment`, `commit`, `register`, `renew`, `setResolution`, `setReverseName`, `transferName`, or `acceptName`. `makeCommitment` is referenced only by the contract and tests.

Therefore the documented user-facing management surface is not implemented. Wallet's guided-send path does not close this gap.

## Indexer / Search integration

420Indexer:

- maps `Names420` to protocol `420Names`;
- derives ABI event descriptors from the planned Genesis artifact;
- fails closed when the required Names420 artifact is missing;
- exposes Names event and latest-state views;
- includes lifecycle handling for registration, renewal, and transfer.

420Search:

- treats 420Names as a distinct source boundary;
- reads protocol state/event history;
- reconstructs public naming state from canonical indexed events.

These derived services must remain subordinate to chain state and must not be treated as canonical ownership/resolution authority.

## Build and test audit

### Baseline evidence

Retained Registry CI builds and runs `RegistryIdentityNames420.t.sol`, which already covers:

- commit/reveal minimum age;
- transfer and resolution reset;
- commitment non-replay after successful registration;
- reverse-resolution forward agreement;
- bilateral Names↔Identity binding.

Wallet tests cover canonical label hashing, ambiguous/Unicode rejection, wrong-chain failure, missing-code failure, wrong contract identity/version, malformed response decoding, label-length mismatch, and trusted block timestamp validation.

### Audit-added tests

`contracts/test/Names420Audit.t.sol` adds:

- shared-interface ABI correctness;
- commitment theft attempt by a different revealer;
- expired commitment;
- invalid label/owner/duration;
- unauthorized renew/resolution/transfer;
- unauthorized transfer acceptance;
- expiry invalidation of forward/reverse/mutation paths;
- safe re-registration by a new owner after expiry.

### Audit-added CI

`.github/workflows/names-audit.yml` binds qualification to the exact PR head and runs:

- frozen interface-layer verifier;
- Foundry format check;
- focused Names420/interface/test build;
- Names420 audit suite;
- retained Registry/Identity/Names integration suite;
- Wallet names-client, names-send and guided-send suites;
- forbidden `tx.origin` / `selfdestruct` / `delegatecall` scan;
- presence checks for commitment, transfer, and reverse-resolution protections.

The local audit environment cannot clone GitHub over the public network, so executable qualification is delegated to repository CI rather than falsely reported as a local run.

## Security classification

| Area | Finding | Classification |
|---|---|---|
| Commitment front-running by copied reveal | committer is included in commitment | verified safe behavior |
| Commitment replay | commitment consumed; active name also blocks overwrite | verified safe behavior |
| Unauthorized mutation | owner/pending-owner checks | verified safe behavior |
| Stale reverse resolution | revalidated against forward target + expiry | verified safe behavior |
| Transfer association carryover | old profile/service links cleared | verified safe behavior |
| Reentrancy | no external mutable call path in Names420 | verified safe behavior |
| Delegatecall/arbitrary call | none in Names420 | verified safe behavior |
| Custody/accounting | contract holds no token custody/accounting | NOT APPLICABLE |
| Oracle/bridge replay | no oracle or cross-chain message path | NOT APPLICABLE |
| Shared resolver interface | baseline return ABI was unsafe; repaired and regression-tested | mitigated risk |
| Unicode/lookalike labels | canonical Wallet client limits to lowercase ASCII, contract stores only hash+length | accepted design/client-boundary risk |
| Dependency-matrix compliance | declared safety interfaces not implemented | unresolved architecture/security gap |
| Deployed bytecode identity | no live/testnet chain verification | unresolved release risk |

No claim of complete security qualification is made while dependency-layer reconciliation and deployed-runtime qualification remain open.

## Documentation audit

Present:

- app index;
- getting started;
- user guide;
- architecture;
- developer integration;
- security guidance;
- troubleshooting;
- broader protocol architecture;
- Genesis documentation matrix entry;
- documentation coverage/inventory records.

Audit correction:

- developer documentation now explicitly defines the canonical resolver tuple and warns consumers never to decode `owner` as `resolvedAddress`.

Still missing/incomplete for release qualification:

- Names-specific deployment/runbook;
- generated artifact/hash/predeploy-state reference;
- live-testnet smoke procedure/results;
- operator/admin recovery procedure tied to deployed state;
- explicit resolution of the dependency-matrix conflict;
- final Genesis acceptance record.

## Genesis/deployment readiness

Canonical address policy is now coherent: **Names420 is 0x0435**. Historical Wallet proposal `0x0445` is retired and not deployable.

However, `predeploy-plan.json` still marks Names420 `SOURCE_READY`. The deployment manifest lacks the runtime artifact/hash/predeploy-state fields already present for the separately audited ProtocolRegistry. Wallet deployment inventory explicitly marks Names420 `FROZEN_SYSTEM_NOT_CHAIN_VERIFIED` with `deploymentVerified: false`.

The public testnet manifest/endpoints are also not qualified. Therefore source existence must not be conflated with deployment.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| canonical `.420` registry/resolver | protocol architecture | `Names420.sol` | retained + audit | architecture | COMPLETE | none |
| lease ownership/expiry | protocol architecture | implemented | retained + audit | architecture/user | COMPLETE | none |
| commit/reveal | protocol architecture | implemented | retained + audit | getting started | COMPLETE | none |
| 60s min commitment age | protocol architecture | constant/enforced | retained | documented | COMPLETE | none |
| 24h max commitment age | protocol architecture | constant/enforced | audit | documented | COMPLETE | none |
| 30–365d duration | protocol architecture | enforced per registration/renewal operation | audit | documented | COMPLETE | none |
| max label length 63 | protocol architecture | input bound | audit invalid-zero; wallet format tests | documented | COMPLETE | retain client canonicalization |
| commitment revealer binding | contract model | committer in commitment | audit theft regression | architecture | COMPLETE | none |
| no overwrite of active lease | contract | enforced | retained replay path | architecture | COMPLETE | add fuzz/invariant in hardening phase |
| forward resolution | protocol architecture | implemented | retained/audit/client | docs | COMPLETE | none |
| reverse resolution | protocol architecture | forward-agreement/expiry checked | retained/audit | docs | COMPLETE | none |
| optional Identity reference | protocol architecture | `profileId` | retained | docs | COMPLETE | none |
| bilateral Identity binding | protocol architecture | read helper + Identity side | retained | docs | COMPLETE | none |
| optional Registry service reference | protocol architecture | `serviceId` | transfer-reset coverage | docs | COMPLETE | deployed Registry integration smoke |
| two-step transfer | protocol architecture | implemented | retained/audit | docs | COMPLETE | none |
| clear links on transfer | protocol architecture | implemented | retained | docs | COMPLETE | none |
| shared `INames420` ABI | frozen interface layer | baseline broken; repaired on audit branch | audit interface regression | developer docs corrected | COMPLETE | merge/review as pre-Genesis interface reconciliation |
| GovernanceAuthority | dependency matrix + NAMES-AUDIT-2 ADR | immutable nonzero governanceTimelock via SystemAccess | dependency-model test | protocol architecture + ADR | COMPLETE | retain direct boundary |
| ProtocolRegistry dependency | NAMES-AUDIT-2 classification | optional consumer integration only; no Names420 runtime call | verifier | architecture + ADR | COMPLETE | consumers validate serviceId independently |
| PauseRegistry | NAMES-AUDIT-2 classification | absent; removed from Names420 runtime matrix | dependency-model verifier | ADR | COMPLETE | NOT_APPLICABLE for current runtime |
| CapabilityRegistry | NAMES-AUDIT-2 classification | absent; removed from Names420 runtime matrix | dependency-model verifier | ADR | COMPLETE | NOT_APPLICABLE for current runtime |
| SystemSafety | NAMES-AUDIT-2 classification | absent; removed from Names420 runtime matrix | dependency-model verifier | ADR | COMPLETE | NOT_APPLICABLE for current runtime |
| GenesisInitialization | NAMES-AUDIT-2 classification | required indirectly at predeploy/deployment layer; not runtime interface | dependency-model verifier | ADR | COMPLETE FOR DEPENDENCY MODEL | implement deterministic state in NAMES-AUDIT-6 |
| Migration | NAMES-AUDIT-2 classification | absent; removed from Names420 runtime matrix | dependency-model verifier | ADR | COMPLETE | NOT_APPLICABLE for current runtime |
| SignedEnvelope | NAMES-AUDIT-2 classification | absent; removed from Names420 runtime matrix | dependency-model verifier | ADR | COMPLETE | NOT_APPLICABLE for current runtime |
| ReplayProtection shared interface | NAMES-AUDIT-2 classification | local committer-bound/consumed commitment mechanism | audit replay tests + verifier | ADR | COMPLETE | shared runtime dependency not required |
| ChainContext | NAMES-AUDIT-2 classification | consumer-layer Wallet chain verification; no Names runtime signature domain | wallet tests + verifier | ADR | COMPLETE | no runtime dependency |
| MetadataCommitment | NAMES-AUDIT-2 classification | absent; removed from Names420 runtime matrix | dependency-model verifier | ADR | COMPLETE | NOT_APPLICABLE for current runtime |
| canonical system address | frozen namespace | 0x0435 consistent across active maps | namespace validators exist | documented | COMPLETE | retain 0x0445 retired |
| predeploy runtime artifact | predeploy plan | planned path only | indexer fails closed when absent | plan note | MISSING | generate pinned `Names420.json` |
| runtime code hash | deployment requirements | absent | absent | absent | MISSING | generate/freeze hash |
| predeploy storage state | storage-init policy | constructor intent only | absent | generic rule | PARTIAL | generate exact storage from compiler layout |
| deployment manifest binding | deployment manifest | address only | generic validators | manifest | PARTIAL | bind artifact/hash/state/source |
| on-chain/testnet verification | wallet deployment inventory | explicitly false | no live smoke | live wallet docs only | BLOCKED | live network + RPC + deployed bytecode |
| 420Indexer descriptors | indexer architecture | mapping/build code present | ABI-manifest tests | architecture | PARTIAL | requires real Names420 artifact |
| Names event/state views | indexer | present | query/lifecycle tests | indexer docs | COMPLETE | live reorg/recovery qualification with deployed chain |
| 420Search discovery | search architecture | present | names_identity tests | architecture | COMPLETE | live integration qualification |
| Wallet resolver | Wallet W14.6 | guarded client present | client/send/guided-send tests | Wallet docs | COMPLETE | live deployment binding |
| user registration UI | Genesis documentation matrix user-facing role | no production write client/UI found | none | workflows documented | MISSING | implement canonical user-facing management surface |
| renewal/update/reverse/transfer UI | same | no production write client/UI found | none | workflows documented | MISSING | implement and test |
| app-specific CI | audit requirement | added on audit branch | workflow itself | this report | PARTIAL | must pass exact final PR head |
| app-specific threat model | audit requirement | architecture/security notes distributed | audit review | security.md terse | PARTIAL | publish dedicated threat model/release assumptions |
| deployment/operator runbook | audit requirement | absent Names-specific runbook | none | generic only | MISSING | create after artifact/deployment model is frozen |
| Genesis acceptance evidence | Genesis requirement | absent | absent | matrix remains pending-audit | MISSING | exact-head build/test/artifact/live evidence |

## Readiness state at this audit stage

- **CODE COMPLETE: NO** — user-facing management application is missing and frozen dependency-layer architecture is unreconciled.
- **BUILD COMPLETE: NO** — focused audit CI must qualify the exact final head, and required generated deployment artifacts do not yet exist.
- **CONTRACT COMPLETE: NO** — core naming logic and the canonical dependency model are reconciled; contract hardening and later artifact/Genesis qualification remain open.
- **TEST COMPLETE: NO** — focused unit/integration coverage is improved, but fuzz/invariant hardening, generated-artifact qualification and live integration are not complete.
- **DOCUMENTATION COMPLETE: NO** — user/developer/security docs exist, but deployment/operator/threat-model/Genesis acceptance documentation remains incomplete.
- **INTEGRATION COMPLETE: NO** — Wallet/indexer/search source integrations exist; live Registry/network/artifact bindings and the user management application do not.
- **SECURITY QUALIFIED: NO** — no unresolved core naming exploit was identified after the interface repair, but architecture/deployment and full hardening gates remain.
- **TESTNET READY: NO** — official testnet manifest/RPC and deployed Names420 code are not qualified.
- **GENESIS READY: NO** — runtime artifact/hash/storage and exact Genesis acceptance evidence are missing.
- **PRODUCTION READY: NO** — depends on all preceding gates plus live operational qualification.

## Numbered remediation roadmap

1. **NAMES-AUDIT-1 — resolver interface reconciliation** — merge the corrected `INames420` ABI and regression test after exact-head CI passes.
2. **NAMES-AUDIT-2 — dependency-model reconciliation** — decide, with an architecture record, whether the frozen 420Names dependency matrix is normative. Implement each retained dependency or amend the matrix before further contract freezing.
3. **NAMES-AUDIT-3 — contract hardening expansion** — add fuzz/property/invariant coverage for registration availability, commitment timing/consumption, expiry, transfer, reverse agreement and renewal bounds; run hardening/static analysis.
4. **NAMES-AUDIT-4 — user-facing application implementation** — implement the documented commit/register, renew, resolution, reverse and transfer workflows with wallet/network/error/transaction states and accessibility/error recovery.
5. **NAMES-AUDIT-5 — generated runtime artifact** — compile the exact canonical Names420 source with pinned compiler settings and freeze reproducible ABI/runtime bytecode/artifact metadata.
6. **NAMES-AUDIT-6 — deterministic Genesis state** — derive constructor/storage state from compiler layout, generate Names420 predeploy state, code hash and storage root, and bind them into deployment/predeploy manifests.
7. **NAMES-AUDIT-7 — indexer/search artifact reconciliation** — build real event descriptors from the frozen Names420 artifact and qualify lifecycle/query/reorg/recovery behavior against those exact descriptors.
8. **NAMES-AUDIT-8 — deployment/operator documentation** — publish Names-specific deployment order, configuration, verification, recovery, monitoring, threat model and known limitations.
9. **NAMES-AUDIT-9 — production-equivalent testnet deployment** — once the official testnet exists, verify chain ID, code at 0x0435, runtime hash, storage, governance binding, Registry discovery, Wallet resolution, indexer/search state, and full user workflows.
10. **NAMES-AUDIT-10 — Genesis acceptance closeout** — re-run all builds/tests/static/security checks on the exact release SHA, attach committed qualification evidence, verify a clean tree and zero unintended divergence, and only then mark Genesis readiness.
11. **NAMES-AUDIT-11 — production qualification** — repeat deployment/runtime/monitoring/recovery verification against the production Genesis candidate and public infrastructure.

## Determination

420Names has a credible and security-conscious core naming contract, strong Wallet resolution safeguards, usable indexer/search integration, and meaningful documentation. It is **not a complete Genesis application yet**.

The most important code defect found in this audit was the stale shared resolver interface, which could cause callers to decode `owner` as the destination address. That defect is repaired on the audit branch with a regression test.

The remaining blockers are broader than unit-test health: canonical interface-layer obligations conflict with the current contract, the documented user-facing management application is absent, runtime/predeploy artifacts are not frozen, and no live testnet deployment exists. These must be resolved in dependency order before 420Names can be declared Genesis-ready.
